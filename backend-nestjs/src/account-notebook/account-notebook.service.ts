import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AccountNotebook } from './account-notebook.entity';

const LIMIT_CAN_PAY_AMOUNT = '12000';
const ZERO_AMOUNT = '0';
const MAX_SERIALIZATION_RETRIES = 8;

const isSerializationError = (error: unknown): boolean => {
  if (error instanceof QueryFailedError) {
    const driverCode = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
    return driverCode === '40001' || error.message.includes('could not serialize access');
  }
  return false;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type IncentiveFlag = 'LowerLimitToPay' | 'LimitCanPay' | 'HigherLimitToPay';

@Injectable()
export class AccountNotebookService {
  constructor(private readonly dataSource: DataSource) {}

  async acceptDebt(
    id: string,
    body: { status: string; user_id_creditor: string },
  ): Promise<{ ok: true; incentive: IncentiveFlag; txId?: string }> {
    if (body?.status !== 'ACCEPTED') {
      throw new BadRequestException('Solo se permite la transicion a status ACCEPTED.');
    }
    if (!body.user_id_creditor) {
      throw new BadRequestException('user_id_creditor es obligatorio.');
    }

    for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction('SERIALIZABLE');

      let shouldRetry = false;

      try {
        await qr.manager.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [body.user_id_creditor]);

        const updDebt = await qr.manager.query(
          `UPDATE public.account_notebook
             SET status = 'ACCEPTED',
                 update_at = now()
           WHERE id = $1
             AND status = 'CREATED'
             AND user_id_creditor = $2
           RETURNING id, status_by_pay_shopkeeper, id_transaction_pay_shopkeeper;`,
          [id, body.user_id_creditor],
        );

        if (updDebt.length === 0) {
          const already = await qr.manager.findOne(AccountNotebook, { where: { id } });
          if (!already) {
            throw new NotFoundException('Deuda no encontrada.');
          }
          if (String(already.user_id_creditor) !== String(body.user_id_creditor)) {
            throw new BadRequestException('El tendero enviado no coincide con la deuda.');
          }
          await qr.commitTransaction();
          return {
            ok: true,
            incentive: (already.status_by_pay_shopkeeper as IncentiveFlag) ?? 'HigherLimitToPay',
            txId: already.id_transaction_pay_shopkeeper ?? undefined,
          };
        }

        await qr.manager.query(
          `INSERT INTO public.user_notebook_subscription (user_id_creditor)
           VALUES ($1)
           ON CONFLICT (user_id_creditor) DO NOTHING;`,
          [body.user_id_creditor],
        );

        const inc = await qr.manager.query(
          `WITH incr AS (
             UPDATE public.user_notebook_subscription
                SET notebook_count_accepted = notebook_count_accepted + 1,
                    update_at = now()
              WHERE user_id_creditor = $1
                AND is_pay_completed = false
                AND notebook_count_accepted < notebook_end_limit
              RETURNING notebook_count_accepted AS pos, notebook_end_limit AS lim
           )
           SELECT pos, lim FROM incr;`,
          [body.user_id_creditor],
        );

        let incentive: IncentiveFlag = 'HigherLimitToPay';
        let txId: string | undefined;

        if (inc.length > 0) {
          const pos = Number(inc[0].pos);
          const lim = Number(inc[0].lim);
          if (pos <= 3) {
            incentive = 'LowerLimitToPay';
          } else if (pos <= lim) {
            incentive = 'LimitCanPay';
            txId = uuidv4().replace(/-/g, '').slice(0, 40);
          }
          if (pos === lim) {
            await qr.manager.query(
              `UPDATE public.user_notebook_subscription
                 SET is_pay_completed = true, update_at = now()
               WHERE user_id_creditor = $1;`,
              [body.user_id_creditor],
            );
          }
        }

        const amountValue = incentive === 'LimitCanPay' ? LIMIT_CAN_PAY_AMOUNT : ZERO_AMOUNT;

        await qr.manager.query(
          `UPDATE public.account_notebook
              SET status_by_pay_shopkeeper = $2,
                  amount = $3::money,
                  id_transaction_pay_shopkeeper = CASE
                     WHEN $4::varchar IS NOT NULL THEN COALESCE(id_transaction_pay_shopkeeper, $4::varchar)
                     ELSE id_transaction_pay_shopkeeper
                  END,
                  update_at = now()
            WHERE id = $1;`,
          [id, incentive, amountValue, txId ?? null],
        );

        await qr.commitTransaction();
        return { ok: true, incentive, txId };
      } catch (error) {
        await qr.rollbackTransaction();
        if (isSerializationError(error) && attempt < MAX_SERIALIZATION_RETRIES) {
          shouldRetry = true;
        } else {
          throw error;
        }
      } finally {
        await qr.release();
      }

      if (shouldRetry) {
        await sleep(25 * attempt);
        continue;
      }
    }

    throw new BadRequestException('No fue posible completar la aceptacion tras multiples intentos.');
  }
}

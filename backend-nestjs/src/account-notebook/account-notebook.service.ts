import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AccountNotebook } from './account-notebook.entity';

type IncentiveFlag = 'LowerLimitToPay' | 'LimitCanPay' | 'HigherLimitToPay';

const LIMIT_CAN_PAY_AMOUNT = '12000';
const ZERO_AMOUNT = '0';

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

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('SERIALIZABLE');
    try {
      // 0) Lock por tendero: serializa las aceptaciones de este tendero, evita condiciones de carrera.
      await qr.manager.query(
        `SELECT pg_advisory_xact_lock(hashtext($1));`,
        [body.user_id_creditor],
      );

      // 1) Aceptar deuda solo si estaba CREATED y pertenece al tendero enviado.
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

      // Si no afectó filas, puede que ya esté aceptada o el tendero sea incorrecto.
      if (updDebt.length === 0) {
        const already = await qr.manager.findOne(AccountNotebook, { where: { id } });
        if (!already) {
          throw new NotFoundException('Deuda no encontrada.');
        }
        if (String(already.user_id_creditor) !== String(body.user_id_creditor)) {
          throw new BadRequestException('El tendero enviado no coincide con la deuda.');
        }
        return {
          ok: true,
          incentive: (already.status_by_pay_shopkeeper as IncentiveFlag) ?? 'HigherLimitToPay',
          txId: already.id_transaction_pay_shopkeeper ?? undefined,
        };
      }

      // 2) Asegurar fila de suscripción (UPSERT)
      await qr.manager.query(
        `INSERT INTO public.user_notebook_subscription (user_id_creditor)
         VALUES ($1)
         ON CONFLICT (user_id_creditor) DO NOTHING;`,
        [body.user_id_creditor],
      );

      // 3) Incremento ATÓMICO → nos da la POSICIÓN
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

      // 4) Persistir resultado en la deuda (idempotente)
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
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}

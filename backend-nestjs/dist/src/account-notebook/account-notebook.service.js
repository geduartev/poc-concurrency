"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountNotebookService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const account_notebook_entity_1 = require("./account-notebook.entity");
const LIMIT_CAN_PAY_AMOUNT = '12000';
const ZERO_AMOUNT = '0';
const MAX_SERIALIZATION_RETRIES = 8;
const isSerializationError = (error) => {
    var _a;
    if (error instanceof typeorm_1.QueryFailedError) {
        const driverCode = (_a = error.driverError) === null || _a === void 0 ? void 0 : _a.code;
        return driverCode === '40001' || error.message.includes('could not serialize access');
    }
    return false;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let AccountNotebookService = class AccountNotebookService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async acceptDebt(id, body) {
        var _a, _b;
        if ((body === null || body === void 0 ? void 0 : body.status) !== 'ACCEPTED') {
            throw new common_1.BadRequestException('Solo se permite la transicion a status ACCEPTED.');
        }
        if (!body.user_id_creditor) {
            throw new common_1.BadRequestException('user_id_creditor es obligatorio.');
        }
        for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
            const qr = this.dataSource.createQueryRunner();
            await qr.connect();
            await qr.startTransaction('SERIALIZABLE');
            let shouldRetry = false;
            try {
                await qr.manager.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [body.user_id_creditor]);
                const updDebt = await qr.manager.query(`UPDATE public.account_notebook
             SET status = 'ACCEPTED',
                 update_at = now()
           WHERE id = $1
             AND status = 'CREATED'
             AND user_id_creditor = $2
           RETURNING id, status_by_pay_shopkeeper, id_transaction_pay_shopkeeper;`, [id, body.user_id_creditor]);
                if (updDebt.length === 0) {
                    const already = await qr.manager.findOne(account_notebook_entity_1.AccountNotebook, { where: { id } });
                    if (!already) {
                        throw new common_1.NotFoundException('Deuda no encontrada.');
                    }
                    if (String(already.user_id_creditor) !== String(body.user_id_creditor)) {
                        throw new common_1.BadRequestException('El tendero enviado no coincide con la deuda.');
                    }
                    await qr.commitTransaction();
                    return {
                        ok: true,
                        incentive: (_a = already.status_by_pay_shopkeeper) !== null && _a !== void 0 ? _a : 'HigherLimitToPay',
                        txId: (_b = already.id_transaction_pay_shopkeeper) !== null && _b !== void 0 ? _b : undefined,
                    };
                }
                await qr.manager.query(`INSERT INTO public.user_notebook_subscription (user_id_creditor)
           VALUES ($1)
           ON CONFLICT (user_id_creditor) DO NOTHING;`, [body.user_id_creditor]);
                const inc = await qr.manager.query(`WITH incr AS (
             UPDATE public.user_notebook_subscription
                SET notebook_count_accepted = notebook_count_accepted + 1,
                    update_at = now()
              WHERE user_id_creditor = $1
                AND is_pay_completed = false
                AND notebook_count_accepted < notebook_end_limit
              RETURNING notebook_count_accepted AS pos, notebook_end_limit AS lim
           )
           SELECT pos, lim FROM incr;`, [body.user_id_creditor]);
                let incentive = 'HigherLimitToPay';
                let txId;
                if (inc.length > 0) {
                    const pos = Number(inc[0].pos);
                    const lim = Number(inc[0].lim);
                    if (pos <= 3) {
                        incentive = 'LowerLimitToPay';
                    }
                    else if (pos <= lim) {
                        incentive = 'LimitCanPay';
                        txId = (0, uuid_1.v4)().replace(/-/g, '').slice(0, 40);
                    }
                    if (pos === lim) {
                        await qr.manager.query(`UPDATE public.user_notebook_subscription
                 SET is_pay_completed = true, update_at = now()
               WHERE user_id_creditor = $1;`, [body.user_id_creditor]);
                    }
                }
                const amountValue = incentive === 'LimitCanPay' ? LIMIT_CAN_PAY_AMOUNT : ZERO_AMOUNT;
                await qr.manager.query(`UPDATE public.account_notebook
              SET status_by_pay_shopkeeper = $2,
                  amount = $3::money,
                  id_transaction_pay_shopkeeper = CASE
                     WHEN $4::varchar IS NOT NULL THEN COALESCE(id_transaction_pay_shopkeeper, $4::varchar)
                     ELSE id_transaction_pay_shopkeeper
                  END,
                  update_at = now()
            WHERE id = $1;`, [id, incentive, amountValue, txId !== null && txId !== void 0 ? txId : null]);
                await qr.commitTransaction();
                return { ok: true, incentive, txId };
            }
            catch (error) {
                await qr.rollbackTransaction();
                if (isSerializationError(error) && attempt < MAX_SERIALIZATION_RETRIES) {
                    shouldRetry = true;
                }
                else {
                    throw error;
                }
            }
            finally {
                await qr.release();
            }
            if (shouldRetry) {
                await sleep(25 * attempt);
                continue;
            }
        }
        throw new common_1.BadRequestException('No fue posible completar la aceptacion tras multiples intentos.');
    }
};
exports.AccountNotebookService = AccountNotebookService;
exports.AccountNotebookService = AccountNotebookService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], AccountNotebookService);
//# sourceMappingURL=account-notebook.service.js.map
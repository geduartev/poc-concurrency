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
let AccountNotebookService = class AccountNotebookService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async acceptDebt(id, body) {
        var _a;
        if (!(body === null || body === void 0 ? void 0 : body.status) || body.status !== 'ACCEPTED') {
            throw new common_1.BadRequestException('Solo se permite la transicion a status ACCEPTED.');
        }
        if (!body.user_id_creditor) {
            throw new common_1.BadRequestException('user_id_creditor es obligatorio.');
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction('SERIALIZABLE');
        try {
            const debt = await queryRunner.manager.findOne(account_notebook_entity_1.AccountNotebook, {
                where: { id },
                lock: { mode: 'pessimistic_write' },
            });
            if (!debt) {
                throw new common_1.NotFoundException('Deuda no encontrada.');
            }
            if (debt.user_id_creditor !== body.user_id_creditor) {
                throw new common_1.BadRequestException('El tendero enviado no coincide con la deuda.');
            }
            if (debt.status === 'ACCEPTED') {
                const response = {
                    ok: true,
                    incentive: (_a = debt.status_by_pay_shopkeeper) !== null && _a !== void 0 ? _a : 'HigherLimitToPay',
                };
                if (debt.id_transaction_pay_shopkeeper) {
                    response.txId = debt.id_transaction_pay_shopkeeper;
                }
                await queryRunner.commitTransaction();
                return response;
            }
            if (debt.status !== 'CREATED') {
                throw new common_1.BadRequestException('La deuda no esta disponible para aceptacion.');
            }
            await queryRunner.manager.query(`INSERT INTO public.user_notebook_subscription (user_id_creditor)
         VALUES ($1)
         ON CONFLICT (user_id_creditor) DO NOTHING;`, [body.user_id_creditor]);
            const incrementResult = await queryRunner.manager.query(`UPDATE public.user_notebook_subscription
             SET
               notebook_count_accepted = notebook_count_accepted + 1,
               update_at = now(),
               is_pay_completed = CASE
                 WHEN notebook_count_accepted + 1 >= notebook_end_limit THEN true
                 ELSE false
               END
           WHERE user_id_creditor = $1
             AND notebook_count_accepted < notebook_end_limit
           RETURNING notebook_count_accepted, notebook_end_limit;`, [body.user_id_creditor]);
            let incentive = 'HigherLimitToPay';
            let txId;
            if (incrementResult.length > 0) {
                const position = Number(incrementResult[0].notebook_count_accepted);
                const endLimit = Number(incrementResult[0].notebook_end_limit);
                if (position <= 3) {
                    incentive = 'LowerLimitToPay';
                }
                else if (position <= endLimit) {
                    incentive = 'LimitCanPay';
                    txId = (0, uuid_1.v4)().replace(/-/g, '');
                }
            }
            const amountValue = incentive === 'LimitCanPay' ? LIMIT_CAN_PAY_AMOUNT : ZERO_AMOUNT;
            await queryRunner.manager.query(`UPDATE public.account_notebook
            SET
              status = 'ACCEPTED',
              update_at = now(),
              status_by_pay_shopkeeper = $2,
              amount = $4::money,
              id_transaction_pay_shopkeeper = CASE
                WHEN $3::varchar IS NOT NULL THEN COALESCE(id_transaction_pay_shopkeeper, $3::varchar)
                ELSE id_transaction_pay_shopkeeper
              END
          WHERE id = $1;`, [id, incentive, txId !== null && txId !== void 0 ? txId : null, amountValue]);
            await queryRunner.commitTransaction();
            const response = {
                ok: true,
                incentive,
            };
            if (txId) {
                response.txId = txId;
            }
            return response;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.AccountNotebookService = AccountNotebookService;
exports.AccountNotebookService = AccountNotebookService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], AccountNotebookService);
//# sourceMappingURL=account-notebook.service.js.map
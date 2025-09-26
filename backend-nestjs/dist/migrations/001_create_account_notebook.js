"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAccountNotebook0011727352000000 = void 0;
class CreateAccountNotebook0011727352000000 {
    constructor() {
        this.name = "CreateAccountNotebook0011727352000000";
    }
    async up(queryRunner) {
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.account_notebook (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        account_id_creditor uuid NOT NULL,
        account_id_debtor uuid NOT NULL,
        user_id_creditor uuid NOT NULL,
        user_id_debtor uuid NOT NULL,
        document_number_creditor varchar,
        amount money NOT NULL,
        status varchar NOT NULL DEFAULT 'CREATED',
        id_transaction varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        update_at timestamp NOT NULL DEFAULT now(),
        id_transaction_pay_shopkeeper varchar(40),
        status_by_pay_shopkeeper varchar(40),
        CONSTRAINT "PK_a1de73c93b81c58debee3de93b8" PRIMARY KEY (id)
      );
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_pay_shopkeeper
        ON public.account_notebook (id_transaction_pay_shopkeeper)
        WHERE id_transaction_pay_shopkeeper IS NOT NULL;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS uq_tx_pay_shopkeeper;');
        await queryRunner.query('DROP TABLE IF EXISTS public.account_notebook;');
    }
}
exports.CreateAccountNotebook0011727352000000 = CreateAccountNotebook0011727352000000;
//# sourceMappingURL=001_create_account_notebook.js.map
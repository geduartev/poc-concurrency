"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserNotebookSubscription0021727352001000 = void 0;
class CreateUserNotebookSubscription0021727352001000 {
    constructor() {
        this.name = "CreateUserNotebookSubscription0021727352001000";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.user_notebook_subscription (
        user_id_creditor uuid PRIMARY KEY,
        type_subscription varchar(40) NOT NULL DEFAULT 'default',
        date_subscription timestamp NOT NULL DEFAULT now(),
        notebook_start_limit int NOT NULL DEFAULT 1,
        notebook_end_limit int NOT NULL DEFAULT 10,
        notebook_count_accepted int NOT NULL DEFAULT 0,
        is_pay_completed boolean NOT NULL DEFAULT false,
        update_at timestamp NOT NULL DEFAULT now()
      );
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_uns_user ON public.user_notebook_subscription(user_id_creditor);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS ix_uns_user;');
        await queryRunner.query('DROP TABLE IF EXISTS public.user_notebook_subscription;');
    }
}
exports.CreateUserNotebookSubscription0021727352001000 = CreateUserNotebookSubscription0021727352001000;
//# sourceMappingURL=002_create_user_notebook_subscription.js.map
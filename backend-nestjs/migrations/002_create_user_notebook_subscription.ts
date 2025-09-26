import { MigrationInterface, QueryRunner } from "typeorm";

// Controla el conteo de aceptaciones por tendero para garantizar limites.
export class CreateUserNotebookSubscription0021727352001000 implements MigrationInterface {
  name = "CreateUserNotebookSubscription0021727352001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ix_uns_user;');
    await queryRunner.query('DROP TABLE IF EXISTS public.user_notebook_subscription;');
  }
}

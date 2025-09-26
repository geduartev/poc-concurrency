import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Entidad fiel a la tabla account_notebook para respetar la migracion proporcionada.
@Entity({ name: 'account_notebook' })
export class AccountNotebook {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  account_id_creditor!: string;

  @Column({ type: 'uuid' })
  account_id_debtor!: string;

  @Column({ type: 'uuid' })
  user_id_creditor!: string;

  @Column({ type: 'uuid' })
  user_id_debtor!: string;

  @Column({ type: 'varchar', nullable: true })
  document_number_creditor!: string | null;

  @Column({ type: 'money' })
  amount!: string;

  @Column({ type: 'varchar', default: 'CREATED' })
  status!: string;

  @Column({ type: 'varchar', nullable: true })
  id_transaction!: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamp', default: () => 'now()' })
  update_at!: Date;

  @Column({ type: 'varchar', length: 40, nullable: true })
  id_transaction_pay_shopkeeper!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  status_by_pay_shopkeeper!: string | null;
}

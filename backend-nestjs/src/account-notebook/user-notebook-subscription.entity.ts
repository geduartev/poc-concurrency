import { Column, Entity, PrimaryColumn } from 'typeorm';

// Control de conteo por tendero para determinar incentivos de manera concurrente.
@Entity({ name: 'user_notebook_subscription' })
export class UserNotebookSubscription {
  @PrimaryColumn({ type: 'uuid' })
  user_id_creditor!: string;

  @Column({ type: 'varchar', length: 40, default: 'default' })
  type_subscription!: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  date_subscription!: Date;

  @Column({ type: 'int', default: 1 })
  notebook_start_limit!: number;

  @Column({ type: 'int', default: 10 })
  notebook_end_limit!: number;

  @Column({ type: 'int', default: 0 })
  notebook_count_accepted!: number;

  @Column({ type: 'boolean', default: false })
  is_pay_completed!: boolean;

  @Column({ type: 'timestamp', default: () => 'now()' })
  update_at!: Date;
}

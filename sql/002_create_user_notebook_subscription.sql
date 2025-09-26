-- Esquema equivalente a la migracion 002 para referencia manual.
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

CREATE INDEX IF NOT EXISTS ix_uns_user ON public.user_notebook_subscription(user_id_creditor);

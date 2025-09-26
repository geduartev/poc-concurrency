-- Esquema equivalente a la migracion 001 para referencia manual.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.account_notebook
(
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_pay_shopkeeper
    ON public.account_notebook (id_transaction_pay_shopkeeper)
    WHERE id_transaction_pay_shopkeeper IS NOT NULL;

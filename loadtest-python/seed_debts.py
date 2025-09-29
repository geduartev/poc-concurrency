import os
import uuid
from decimal import Decimal
from typing import List

import psycopg2

# Script para generar 20 deudas

def _conn_kwargs():
    return {
        "host": os.getenv("PGHOST", "localhost"),
        "port": os.getenv("PGPORT", "5432"),
        "dbname": os.getenv("PGDATABASE", "poc_concurrency"),
        "user": os.getenv("PGUSER", "postgres"),
        "password": os.getenv("PGPASSWORD", "postgres"),
    }

def main() -> None:
    user_id_creditor = os.getenv("USER_ID_CREDITOR") or str(uuid.uuid4())
    account_id_creditor = os.getenv("ACCOUNT_ID_CREDITOR") or str(uuid.uuid4())
    amount_value = os.getenv("DEBT_AMOUNT", "0")

    with psycopg2.connect(**_conn_kwargs()) as conn:
        with conn.cursor() as cur:
            ids: List[str] = []
            for i in range(20):
                account_id_debtor = str(uuid.uuid4())
                user_id_debtor = str(uuid.uuid4())
                document = f"CC{1000 + i:06d}"
                cur.execute(
                    """
                    INSERT INTO public.account_notebook (
                        account_id_creditor,
                        account_id_debtor,
                        user_id_creditor,
                        user_id_debtor,
                        document_number_creditor,
                        amount,
                        status
                    ) VALUES (%s, %s, %s, %s, %s, %s::money, 'CREATED')
                    RETURNING id;
                    """,
                    (
                        account_id_creditor,
                        account_id_debtor,
                        user_id_creditor,
                        user_id_debtor,
                        document,
                        Decimal(amount_value),
                    ),
                )
                ids.append(cur.fetchone()[0])

    print(f"NOTEBOOK_IDS={','.join(ids)}")
    print(f"USER_ID_CREDITOR={user_id_creditor}")
    print(f"ACCOUNT_ID_CREDITOR={account_id_creditor}")

if __name__ == "__main__":
    main()

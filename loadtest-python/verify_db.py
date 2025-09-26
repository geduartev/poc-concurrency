import os
import psycopg2

# Verifica en la base que la distribucion de incentivos cumpla 3/7/10.


def _conn_kwargs():
    return {
        "host": os.getenv("PGHOST", "localhost"),
        "port": os.getenv("PGPORT", "5432"),
        "dbname": os.getenv("PGDATABASE", "poc_concurrency"),
        "user": os.getenv("PGUSER", "postgres"),
        "password": os.getenv("PGPASSWORD", "postgres"),
    }


def main() -> None:
    with psycopg2.connect(**_conn_kwargs()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(status_by_pay_shopkeeper, 'SIN_CLASIFICAR') AS flag,
                       COUNT(*)
                FROM public.account_notebook
                GROUP BY flag
                ORDER BY flag;
                """
            )
            rows = cur.fetchall()

    print("Distribucion actual de incentivos:")
    for flag, count in rows:
        print(f"{flag}: {count}")


if __name__ == "__main__":
    main()

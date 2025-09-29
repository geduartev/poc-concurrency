import asyncio
import os
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Dict, List, Tuple

import httpx
import psycopg2

RETRY_STATUS = {409, 429, 500, 502, 503, 504}


@dataclass
class TenderBatch:
    user_id_creditor: str
    account_id_creditor: str
    debt_ids: List[str]


def _conn_kwargs() -> Dict[str, str]:
    return {
        "host": os.getenv("PGHOST", "localhost"),
        "port": os.getenv("PGPORT", "5432"),
        "dbname": os.getenv("PGDATABASE", "poc_concurrency"),
        "user": os.getenv("PGUSER", "postgres"),
        "password": os.getenv("PGPASSWORD", "postgres"),
    }


def reset_database_if_needed(reset: bool) -> None:
    if not reset:
        return
    with psycopg2.connect(**_conn_kwargs()) as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE account_notebook, user_notebook_subscription RESTART IDENTITY;")
    print("Base reiniciada (TRUNCATE).")


def seed_batches(tender_count: int, debts_per_tender: int) -> List[TenderBatch]:
    batches: List[TenderBatch] = []
    with psycopg2.connect(**_conn_kwargs()) as conn:
        with conn.cursor() as cur:
            for _ in range(tender_count):
                user_id_creditor = str(uuid.uuid4())
                account_id_creditor = str(uuid.uuid4())
                debt_ids: List[str] = []
                for idx in range(debts_per_tender):
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
                            str(uuid.uuid4()),
                            user_id_creditor,
                            str(uuid.uuid4()),
                            f"CC{1000 + idx:06d}",
                            0,
                        ),
                    )
                    debt_ids.append(cur.fetchone()[0])
                batches.append(TenderBatch(user_id_creditor, account_id_creditor, debt_ids))
    return batches


async def _fire_request(
    client: httpx.AsyncClient,
    debt_id: str,
    payload: Dict[str, str],
    request_semaphore: asyncio.Semaphore,
) -> Dict[str, str]:
    backoff = 0.5
    async with request_semaphore:
        last_error: str | None = None
        for _attempt in range(6):
            try:
                response = await client.patch(
                    f"/account-notebook/{debt_id}/status",
                    json=payload,
                )
            except httpx.HTTPError as exc:
                last_error = f"HTTPError: {exc}"
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            if response.status_code == 200:
                return response.json()
            if response.status_code in RETRY_STATUS:
                last_error = f"status={response.status_code} body={response.text}"
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            content = await response.aread()
            raise RuntimeError(
                f"Error definitivo {response.status_code} para {debt_id}: {content.decode(errors='ignore')}"
            )
        raise RuntimeError(
            f"No se pudo procesar la deuda {debt_id} tras multiples intentos. Ultimo error: {last_error}"
        )


async def accept_batches(
    batches: List[TenderBatch],
    request_concurrency: int,
    attempts_per_debt: int,
) -> Dict[str, Counter]:
    base_url = os.getenv("API_BASE", "http://localhost:3000")
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    api_key = os.getenv("API_KEY")
    if api_key:
        headers["x-api-key"] = api_key

    limits = httpx.Limits(
        max_connections=request_concurrency * 2,
        max_keepalive_connections=request_concurrency,
    )

    async with httpx.AsyncClient(
        base_url=base_url,
        headers=headers,
        timeout=20.0,
        limits=limits,
    ) as client:
        request_semaphore = asyncio.Semaphore(request_concurrency)
        tasks: List[asyncio.Task] = []
        metadata: List[Tuple[str, asyncio.Task]] = []

        for batch in batches:
            payload = {"status": "ACCEPTED", "user_id_creditor": batch.user_id_creditor}
            # el primer intento crea la suscripción; los extras fuerzan la concurrencia extrema.
            for debt_id in batch.debt_ids:
                for attempt in range(attempts_per_debt):
                    headers_payload = payload
                    if attempt > 0:
                        # este flag ayuda a identificar en logs cuándo se trata de intentos repetidos
                        headers_payload = dict(payload)
                        headers_payload["__attempt"] = str(attempt)
                    task = asyncio.create_task(
                        _fire_request(client, debt_id, headers_payload, request_semaphore)
                    )
                    tasks.append(task)
                    metadata.append((batch.user_id_creditor, task))

        await asyncio.gather(*tasks)

    counters: Dict[str, Counter] = defaultdict(Counter)
    for tender_id, task in metadata:
        result = task.result()
        counters[tender_id][result.get("incentive")] += 1
    return counters


def verify_distribution(batches: List[TenderBatch], debts_per_tender: int) -> None:
    query = """
        SELECT user_id_creditor,
               status_by_pay_shopkeeper,
               COUNT(*) AS total,
               MIN(amount)::numeric AS min_amount,
               MAX(amount)::numeric AS max_amount
        FROM public.account_notebook
        WHERE user_id_creditor = ANY(%s::uuid[])
        GROUP BY user_id_creditor, status_by_pay_shopkeeper
    """
    expected = {
        "LowerLimitToPay": 3,
        "LimitCanPay": 7,
        "HigherLimitToPay": max(0, debts_per_tender - 10),
    }

    with psycopg2.connect(**_conn_kwargs()) as conn:
        with conn.cursor() as cur:
            cur.execute(query, ([b.user_id_creditor for b in batches],))
            grouped: Dict[str, Dict[str, Dict[str, float]]] = {}
            for user_id_creditor, flag, total, min_amount, max_amount in cur.fetchall():
                grouped.setdefault(user_id_creditor, {})[flag] = {
                    "total": total,
                    "min": float(min_amount),
                    "max": float(max_amount),
                }

    for batch in batches:
        dist = grouped.get(batch.user_id_creditor, {})
        counts = {flag: dist.get(flag, {}).get('total', 0) for flag in expected}
        if counts != expected:
            raise AssertionError(f"Tendero {batch.user_id_creditor} con distribucion inesperada {counts}")
        limit_info = dist.get('LimitCanPay')
        if limit_info and (limit_info['min'] != 12000 or limit_info['max'] != 12000):
            raise AssertionError(f"Tendero {batch.user_id_creditor} con monto invalido en LimitCanPay")
        for flag in ('LowerLimitToPay', 'HigherLimitToPay'):
            info = dist.get(flag)
            if info and (info['min'] != 0 or info['max'] != 0):
                raise AssertionError(f"Tendero {batch.user_id_creditor} con monto invalido en {flag}")


def main() -> None:
    tender_count = int(os.getenv("TENDER_COUNT", "20"))
    debts_per_tender = int(os.getenv("DEBTS_PER_TENDER", "20"))
    request_concurrency = int(os.getenv("REQUEST_CONCURRENCY", "80"))
    attempts_per_debt = max(1, int(os.getenv("ATTEMPTS_PER_DEBT", "1")))
    reset_db = os.getenv("RESET_DB", "true").lower() in {"1", "true", "yes"}

    reset_database_if_needed(reset_db)

    print(f"Generando {tender_count} tenderos con {debts_per_tender} deudas cada uno...")
    batches = seed_batches(tender_count, debts_per_tender)
    print("Total de deudas creadas:", len(batches) * debts_per_tender)

    print(
        "Lanzando aceptaciones concurrentes con",
        f"request_concurrency={request_concurrency}",
        f"attempts_per_debt={attempts_per_debt}",
    )
    counters = asyncio.run(accept_batches(batches, request_concurrency, attempts_per_debt))

    for tender_id, counter in counters.items():
        print(f"{tender_id}: {dict(counter)}")

    print("Verificando distribucion en la base de datos...")
    verify_distribution(batches, debts_per_tender)
    print("✅ Todos los tenderos cumplen la distribucion 3/7/10")


if __name__ == '__main__':
    main()

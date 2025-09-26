import asyncio
import os
from collections import Counter
from typing import Dict, List

import httpx

# Cliente de carga simple que lanza 20 PATCH concurrentes contra el endpoint.

RETRY_STATUS = {409, 429, 500, 502, 503, 504}


def _build_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    api_key = os.getenv("API_KEY")
    if api_key:
        headers["x-api-key"] = api_key
    return headers


def _notebook_ids() -> List[str]:
    raw = os.getenv("NOTEBOOK_IDS")
    if not raw:
        raise SystemExit("NOTEBOOK_IDS no esta definido. Ejecuta seed_debts.py primero.")
    return [value.strip() for value in raw.split(",") if value.strip()]


async def _fire_request(client: httpx.AsyncClient, debt_id: str, payload: Dict[str, str]) -> Dict[str, str]:
    backoff = 0.5
    for _attempt in range(5):
        response = await client.patch(f"/account-notebook/{debt_id}/status", json=payload)
        if response.status_code == 200:
            return response.json()
        if response.status_code in RETRY_STATUS:
            await asyncio.sleep(backoff)
            backoff *= 2
            continue
        response.raise_for_status()
    raise RuntimeError(f"No se pudo procesar la deuda {debt_id} tras multiples intentos")


async def main_async() -> None:
    base_url = os.getenv("API_BASE", "http://localhost:3000")
    user_id_creditor = os.getenv("USER_ID_CREDITOR")
    if not user_id_creditor:
        raise SystemExit("USER_ID_CREDITOR no esta definido. Usa el valor impreso por seed_debts.py.")

    payload = {"status": "ACCEPTED", "user_id_creditor": user_id_creditor}
    headers = _build_headers()

    async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=10.0) as client:
        tasks = [
            _fire_request(client, debt_id, payload)
            for debt_id in _notebook_ids()
        ]
        results = await asyncio.gather(*tasks)

    counter = Counter(result.get("incentive") for result in results)
    for key in ("LowerLimitToPay", "LimitCanPay", "HigherLimitToPay"):
        print(f"{key}: {counter.get(key, 0)}")


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()

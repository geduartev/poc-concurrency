# PoC Concurrency - Incentivos Confiados

PoC completa para validar la distribucion de incentivos (3/7/10) cuando 20 aceptaciones concurrentes afectan al mismo tendero.

## Requisitos

- Docker + docker-compose
- Node.js 20+
- Python 3.10+ (con `pip`)

## Pasos rapidos

1. Copia el archivo de entorno:
   ```bash
   cp backend-nestjs/.env.example backend-nestjs/.env
   ```
2. Levanta Postgres (y opcionalmente el backend):
   ```bash
   make up
   # o
   docker-compose up -d postgres
   ```
3. Instala dependencias y ejecuta migraciones:
   ```bash
   make migrate
   ```
4. Genera las 20 deudas de prueba:
   ```bash
   make seed
   ```
   El script imprime `NOTEBOOK_IDS=...` y `USER_ID_CREDITOR=...`. Exporta ambos valores antes de ejecutar la prueba de concurrencia, por ejemplo:
   ```bash
   set NOTEBOOK_IDS=uuid1,uuid2,...
   set USER_ID_CREDITOR=uuid-del-tendero
   ```
5. Lanza la carga concurrente:
   ```bash
   make test
   ```
   Espera ver el conteo `LowerLimitToPay: 3`, `LimitCanPay: 7`, `HigherLimitToPay: 10`.
6. (Opcional) Corrobora la distribucion directamente en la base:
   ```bash
   make verify
   ```

## Servicios

- Backend NestJS en `./backend-nestjs` con endpoint `PATCH /account-notebook/:id/status`.
- Scripts de alta carga en `./loadtest-python` (usa `httpx` + `asyncio`).
- Docker Compose levanta Postgres (`postgres:15`) y un contenedor Node 20 listo para correr el backend mapeando el codigo local.

## Notas tecnicas

- El microservicio usa TypeORM con transacciones `SERIALIZABLE` y un `UPDATE ... RETURNING` para asignar posiciones unicas bajo concurrencia.
- El indice parcial `uq_tx_pay_shopkeeper` evita duplicar incentivos (`id_transaction_pay_shopkeeper`).
- Los scripts Python respetan las mismas variables de entorno (`PGHOST`, `PGPORT`, etc.) que el backend.

## Limpieza

```bash
docker-compose down
```

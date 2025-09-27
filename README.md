# PoC Concurrency - Incentivos Confiados

Esta PoC muestra cómo garantizar la regla de incentivos 3/7/10 incluso cuando decenas de clientes aceptan su deuda al mismo tiempo. A continuación se detalla, paso a paso y en lenguaje cotidiano, cómo levantar el entorno, correr el microservicio, probar con Postman y ejecutar las pruebas de carga.

## 1. Levantar Postgres con Docker

El repositorio trae un `docker-compose.yml` con un Postgres listo para usar (usuario/clave `postgres`). Al levantarlo se creará automáticamente el contenedor con la base `poc_concurrency`.

```powershell
# Desde la raíz del repo
make up
# Alternativa sin make
docker-compose up -d postgres
```

Verifica que el contenedor está sano (opcional):

```powershell
docker ps
```

Cuando termines, puedes bajar el contenedor con:

```powershell
docker-compose down
```

## 2. Ejecutar el microservicio NestJS

1. Copia el archivo de entorno y ajusta variables si lo deseas:
   ```powershell
   Copy-Item backend-nestjs/.env.example backend-nestjs/.env
   ```
2. Instala dependencias, compila y aplica migraciones (creará las tablas necesarias):
   ```powershell
   make migrate
   # o manualmente
   cd backend-nestjs
   npm install
   npm run build
   npm run migration:run
   ```
3. Levanta el servicio (modo watch ideal para desarrollo):
   ```powershell
   cd backend-nestjs
   npm run start:dev
   ```
   El API quedará disponible en `http://localhost:3000`.

### Probar con Postman

- Método: `PATCH`
- URL: `http://localhost:3000/account-notebook/<ID>/status`
- Header obligatorio: `Content-Type: application/json`
- Header opcional: `x-api-key` si definiste `API_KEY` en `.env`
- Cuerpo de ejemplo:
  ```json
  {
    "status": "ACCEPTED",
    "user_id_creditor": "<uuid-del-tendero>"
  }
  ```
  Usa uno de los IDs generados por el script de seed (ver siguiente sección). Si la aceptación ya se había procesado, la respuesta sigue siendo `ok: true` con el mismo incentivo (idempotencia).

## 3. Scripts básicos de prueba

Todos los scripts Python respetan las mismas variables de entorno (`PGHOST`, `PGPORT`, etc.) que el backend y se ejecutan desde la raíz del repo. Si no tienes `make`, puedes correr los comandos mostrados manualmente.

1. **Instalar dependencias Python (una sola vez):**
   ```powershell
   python -m pip install -r loadtest-python/requirements.txt
   ```

2. **Generar 20 deudas para un tendero:**
   ```powershell
   make seed
   # o
   python loadtest-python/seed_debts.py
   ```
   El script imprime algo como:
   ```
   NOTEBOOK_IDS=uuid1,uuid2,...
   USER_ID_CREDITOR=uuid-del-tendero
   ```
   Copia esos valores y expórtalos en la misma terminal:
   ```powershell
   $env:NOTEBOOK_IDS = "uuid1,uuid2,..."
   $env:USER_ID_CREDITOR = "uuid-del-tendero"
   ```

3. **Lanzar las 20 aceptaciones concurrentes para ese tendero:**
   ```powershell
   make test
   # o
   python loadtest-python/concurrent_accept.py
   ```
   Deberías ver:
   ```
   LowerLimitToPay: 3
   LimitCanPay: 7
   HigherLimitToPay: 10
   ```

4. **Verificar en la base de datos:**
   ```powershell
   make verify
   # o
   python loadtest-python/verify_db.py
   ```

## 4. Prueba de carga multi-tendero (20 tenderos x 20 deudas)

El script `multi_tender_loadtest.py` siembra automáticamente N tenderos con M deudas y valida que cada uno respete la distribución 3/7/10.

Comando principal:
```powershell
make test-multi
# sin make
python loadtest-python/multi_tender_loadtest.py
```

### Variables útiles (todas opcionales)
- `TENDER_COUNT` (default `20`): cuántos tenderos se generan.
- `DEBTS_PER_TENDER` (default `20`): deudas por tendero.
- `REQUEST_CONCURRENCY` (default `40`): máximo de requests simultáneos contra el API.
- `TENDER_CONCURRENCY` (default `4`): cuántos tenderos se ejecutan en paralelo.
- `RESET_DB` (default `true`): si es `true`, se hace `TRUNCATE` antes de sembrar.
- `API_BASE`, `API_KEY` por si cambias la URL o usas API key.

Ejemplo:
```powershell
$env:TENDER_COUNT = "30"
$env:DEBTS_PER_TENDER = "25"
$env:REQUEST_CONCURRENCY = "60"
$env:TENDER_CONCURRENCY = "6"
python loadtest-python/multi_tender_loadtest.py
```
El script imprimirá la distribución por tendero y termina con `✅ Todos los tenderos cumplen la distribucion 3/7/10` si no hubo inconsistencias; de lo contrario lanza una excepción detallando el tendero afectado.

## Servicios y arquitectura

- Backend NestJS en `./backend-nestjs`, endpoint principal `PATCH /account-notebook/:id/status`.
- Scripts de carga y verificación en `./loadtest-python` (httpx + asyncio + psycopg2).
- Docker Compose levanta Postgres (`postgres:15`) y opcionalmente un contenedor Node 20 que arranca el backend con el código local montado.

## Notas técnicas

- Las transacciones usan nivel `SERIALIZABLE` más `pg_advisory_lock` por tendero, lo que asegura una posición única (1..n) para cada aceptación concurrente.
- El servicio detecta y reintenta automáticamente los errores `could not serialize access`.
- El índice parcial `uq_tx_pay_shopkeeper` evita duplicar incentivos (una misma deuda no puede tener dos `id_transaction_pay_shopkeeper`).
- Los montos se actualizan dentro de la misma transacción: posiciones 1–3 → 0, 4–10 → 12 000, 11+ → 0.

## Limpieza

```powershell
docker-compose down
```
Esto detiene y elimina el contenedor de Postgres creado por la PoC.

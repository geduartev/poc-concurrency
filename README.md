# PoC Concurrency

Esta prueba de concepto muestra cómo validar la regla 3/7/10 aun cuando muchos clientes aceptan sus deudas al mismo tiempo.

---

## Estructura del repositorio

```
poc-concurrency/
├── backend-nestjs/          # Microservicio NestJS + TypeORM
│   ├── src/                 # Código fuente
│   ├── migrations/          # Tablas account_notebook y user_notebook_subscription
│   ├── package.json         # Dependencias y scripts npm
│   └── ...
├── loadtest-python/         # Python
├── sql/                     # SQL
├── docker-compose.yml       # Contenedor
├── Makefile                 # Atajos
└── README.md                # Ayuda
```

---

## Requisitos previos
1. **Docker Desktop**. Levanta para ejectuar Postgres.
2. **Node.js 20+** . Necesario para NestJS.
3. **Python 3.10+** con `pip`. Pruebas con Python.

Nota: Los scripts y docker se encargan de instalar nestjs, typeorm y postgres.

---

## Paso 1 · Levantar Postgres con Docker
Archivo `docker-compose.yml` define Postgres con usuario/clave `postgres` y BD `poc_concurrency`. Al levantarlo se crea automáticamente el contenedor.
- Para iniciarlo cualquier de estas dos:

```powershell
docker-compose up -d postgres
```

- El contenedor expone `localhost:5432`.
- Para detenerlo después: `docker-compose down`.

```powershell
docker-compose down
```

---

## Paso 2 · Preparar y ejecutar el backend NestJS

1. **Ejemplos**:

   ```powershell
   Copy-Item backend-nestjs/.env.example backend-nestjs/.env
   ```

2. **Instalar dependencias, compilar y aplicar migraciones**:

   Internamente ejecuta `npm install`, `npm run build` y `npm run migration:run`.

   ```powershell
   cd backend-nestjs
   npm install
   npm run build
   npm run migration:run
   cd ..
   ```

   Esto crea las tablas necesarias.

3. **Levantar el servicio**:

   ```powershell
   cd backend-nestjs
   npm run start:dev
   ```

   - El API queda en `http://localhost:3000`.

---

## Paso 3 · Probar manualmente con Postman
Necesitas dos valores:
- `ID de la deuda` (`account_notebook.id`, UUID) → lo genera el script `seed_debts.py` en la BD.
- `user_id_creditor` (UUID del tendero) → lo genera el mismo script `seed_debts.py` en la BD.

**Configuración del request:**
- Método: `PATCH`
- URL: `http://localhost:3000/account-notebook/<ID>/status`
  - Reemplaza `<ID>` por el UUID real por el valor en BD.
- Encabezados:
  - `Content-Type: application/json`
  - `x-api-key` si en `.env` activaste `API_KEY`.
- Cuerpo (`raw` JSON):

  ```json
  {
    "status": "ACCEPTED",
    "user_id_creditor": "<uuid-del-tendero>"
  }
  ```

  Reemplaza `<uuid-del-tendero>` por un valor de la BD..

Respuesta esperada (ejemplo):

```json
{
  "ok": true,
  "incentive": "LimitCanPay",
  "txId": "..."  // solo aparece si se otorga un monto
}
```

Si llamas varias veces al mismo `ID`, la respuesta se repite (idempotencia).

---

## Paso 4 · Scripts Python
Instalar por única vez dependencias de Python:

```powershell
python -m pip install -r loadtest-python/requirements.txt
```

### 4.1 Deudas de clientes

```powershell
python loadtest-python/seed_debts.py
```

Crea por única vez 20 deudas en BD.

```
NOTEBOOK_IDS=uuid1,uuid2,...,uuid20
USER_ID_CREDITOR=uuid-del-tendero
ACCOUNT_ID_CREDITOR=uuid-de-la-cuenta
```

- `NOTEBOOK_IDS`: 20 UUID separados por comas (una deuda por cada cliente).
- `USER_ID_CREDITOR`: UUID del prestamista dueño de esas deudas.
- `ACCOUNT_ID_CREDITOR`: información adicional (no obligatoria para las pruebas).

### 4.2 Exportar variables de entorno
Los scripts siguientes leen `NOTEBOOK_IDS` y `USER_ID_CREDITOR` desde variables de entorno. Ejemplos:
- **PowerShell**

  ```powershell
  $env:NOTEBOOK_IDS = "uuid1,uuid2,..."
  $env:USER_ID_CREDITOR = "uuid-del-tendero"
  ```

- **CMD**

  ```cmd
  set NOTEBOOK_IDS=uuid1,uuid2,...
  set USER_ID_CREDITOR=uuid-del-tendero
  ```

- **Git Bash / Linux / macOS**

  ```bash
  export NOTEBOOK_IDS="uuid1,uuid2,..."
  export USER_ID_CREDITOR="uuid-del-tendero"
  ```

### 4.3 Ejecutar la carga concurrente del tendero

```powershell
python loadtest-python/concurrent_accept.py
```

- Envía 20 `PATCH` en paralelo usando `httpx` + `asyncio`.
- Reintenta ante errores 409/429/5xx.
- Resultado esperado:

  ```
  LowerLimitToPay: 3
  LimitCanPay: 7
  HigherLimitToPay: 10
  ```

### 4.4 Verificar la base directamente

```powershell
python loadtest-python/verify_db.py
```

Resumen agrupado por `status_by_pay_shopkeeper`, confirmando la distribución 3/7/10 y los montos ($0 vs $12.000).

---

## Paso 5 · Prueba de carga multi-tendero (SIN LOTES COMO SE TENIA RESTRICCION)
`loadtest-python/multi_tender_loadtest.py` crea varios tenderos y lanza **todas las deudas al mismo tiempo** (sin procesarlas por bloques). Cada deuda es una tarea independiente, controlada únicamente por un semáforo global.

```powershell
python loadtest-python/multi_tender_loadtest.py
```

### Configuración
Ajusta las variables antes de ejecutar el script:
| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `TENDER_COUNT` | Número de tenderos a generar | 200 |
| `DEBTS_PER_TENDER` | Deudas por tendero | 20 |
| `REQUEST_CONCURRENCY` | Máximo de solicitudes simultáneas contra el API (global, sin lotes) | 20 |
| `ATTEMPTS_PER_DEBT` | Reintentos para validar idempotencia | 1 |
| `RESET_DB` | Si `true`, realiza `TRUNCATE` antes de la insercción en BD | true |
| `API_BASE` | URL del backend | `http://localhost:3000` |
| `API_KEY` | API key si la definiste | (vacío) |

Ejemplo en PowerShell:

```powershell
python loadtest-python/verify_db.py
$env:TENDER_COUNT = "200"
$env:DEBTS_PER_TENDER = "20"
$env:REQUEST_CONCURRENCY = "20"
$env:ATTEMPTS_PER_DEBT = "1" 
python loadtest-python/multi_tender_loadtest.py
```

El script imprime la distribución por prestamista y falla con un mensaje claro si algún cliente no termina con 3/7/10 o si los montos difieren de $0/$12.000.

---

## Limpieza
Detén y elimina el contenedor de Postgres cuando termines:

```powershell
docker-compose down
```

---

## Notas técnicas
- Cada aceptación se procesa en una transacción `SERIALIZABLE` con `pg_advisory_xact_lock`, garantizando que las posiciones (1..n) sean únicas por prestamista.
- Si Postgres devuelve `could not serialize access`, el servicio reintenta automáticamente hasta 8 veces con un breve backoff.
- `UPDATE ... RETURNING` se usa sobre `user_notebook_subscription` para conocer la posición aceptada y clasificar el incentivo sin condiciones de carrera.
- El monto (`amount`) se actualiza en el mismo `UPDATE`: posiciones 1–3 → $0, 4–10 → $12.000, ≥11 → $0.
- El índice parcial `uq_tx_pay_shopkeeper` impide duplicar incentivos para la misma deuda.
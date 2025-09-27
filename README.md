# PoC Concurrency - Incentivos Confiados

Esta prueba de concepto muestra cómo validar la regla 3/7/10 aun cuando muchos clientes aceptan sus deudas al mismo tiempo. A continuación encontrarás cada paso explicado de forma simple: qué instalar, cómo levantar los servicios, cómo probar manualmente y cómo lanzar la prueba de carga completa.

---

## Estructura del repositorio

```
poc-concurrency/
├── backend-nestjs/          # Microservicio NestJS + TypeORM
│   ├── src/                 # Código fuente (controladores, servicios, entidades)
│   ├── migrations/          # Migraciones para las tablas account_notebook y user_notebook_subscription
│   ├── package.json         # Dependencias y scripts npm
│   └── ...
├── loadtest-python/         # Scripts Python (seed, carga concurrente, verificación, multi-tendero)
├── sql/                     # SQL equivalente a las migraciones
├── docker-compose.yml       # Postgres y contenedor opcional del backend
├── Makefile                 # Atajos (opcionales) para los comandos
└── README.md                # Este documento
```

---

## Requisitos previos

1. **Docker Desktop** (o Docker Engine). Debe estar ejecutándose para levantar Postgres.
2. **Node.js 20+** (incluye npm). Necesario para NestJS.
3. **Python 3.10+** con `pip`. Usamos scripts de prueba en Python.
4. (Opcional) **PowerShell** o **Git Bash**. Las instrucciones usan PowerShell, pero indico comandos equivalentes para CMD.

No necesitas instalar NestJS, TypeORM ni Postgres manualmente: los scripts y Docker se encargan.

---

## Paso 1 · Levantar Postgres con Docker

El archivo `docker-compose.yml` define un Postgres con usuario/clave `postgres` y base `poc_concurrency`. Al levantarlo se crea automáticamente el contenedor.

```powershell
# Desde la raíz del repositorio
make up
```

¿Sin `make`?
```powershell
docker-compose up -d postgres
```

- El contenedor expone `localhost:5432`.
- Para detenerlo después: `docker-compose down`.

---

## Paso 2 · Preparar y ejecutar el backend NestJS

1. **Copiar el archivo de entorno** (trae ejemplos de configuración TypeORM y API):
   ```powershell
   Copy-Item backend-nestjs/.env.example backend-nestjs/.env
   ```
   Si tu Postgres está en otro host o quieres activar `API_KEY`, edita `backend-nestjs/.env`.

2. **Instalar dependencias, compilar y aplicar migraciones**:
   ```powershell
   make migrate
   ```
   Internamente ejecuta `npm install`, `npm run build` y `npm run migration:run`. Sin `make`:
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
   - Se recarga solo si cambias código en `src/`.

---

## Paso 3 · Probar manualmente con Postman

Necesitas dos valores:
- `ID de la deuda` (`account_notebook.id`, UUID) → lo genera el script `seed_debts.py`.
- `user_id_creditor` (UUID del tendero) → el mismo script lo imprime.

**Configuración del request:**
- Método: `PATCH`
- URL: `http://localhost:3000/account-notebook/<ID>/status`
  - Reemplaza `<ID>` por el UUID real, por ejemplo `865343c6-839c-46f8-bd44-b741026709ab`.
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
  Reemplaza `<uuid-del-tendero>` por el valor real impreso por el sembrado.

Respuesta esperada (ejemplo):
```json
{
  "ok": true,
  "incentive": "LimitCanPay",
  "txId": "..."  // solo aparece si se otorga incentivo
}
```
Si llamas varias veces al mismo `ID`, la respuesta se repite (lógica idempotente).

---

## Paso 4 · Scripts Python para un tendero

Instala dependencias una vez:
```powershell
python -m pip install -r loadtest-python/requirements.txt
```

### 4.1 Sembrar 20 deudas para un tendero

```powershell
python loadtest-python/seed_debts.py
```
Salida típica:
```
NOTEBOOK_IDS=uuid1,uuid2,...,uuid20
USER_ID_CREDITOR=uuid-del-tendero
ACCOUNT_ID_CREDITOR=uuid-de-la-cuenta
```
- `NOTEBOOK_IDS`: 20 UUID separados por comas (una deuda por cada cliente).
- `USER_ID_CREDITOR`: UUID del tendero dueño de esas deudas.
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
Muestra un resumen agrupado por `status_by_pay_shopkeeper`, confirmando la distribución 3/7/10 y los montos ($0 vs $12.000).

---

## Paso 5 · Prueba de carga multi-tendero (sin lotes)

`loadtest-python/multi_tender_loadtest.py` crea varios tenderos y lanza **todas las deudas al mismo tiempo** (sin procesarlas por bloques). Cada deuda es una tarea independiente, controlada únicamente por un semáforo global.

```powershell
python loadtest-python/multi_tender_loadtest.py
```

### Configuración

Ajusta las variables antes de ejecutar el script:

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `TENDER_COUNT` | Número de tenderos a generar | 20 |
| `DEBTS_PER_TENDER` | Deudas por tendero | 20 |
| `REQUEST_CONCURRENCY` | Máximo de solicitudes simultáneas contra el API (global, sin lotes) | 80 |
| `RESET_DB` | Si `true`, realiza `TRUNCATE` antes del sembrado | true |
| `API_BASE` | URL del backend | `http://localhost:3000` |
| `API_KEY` | API key si la definiste | (vacío) |

Ejemplo en PowerShell:
```powershell
$env:TENDER_COUNT = "30"
$env:DEBTS_PER_TENDER = "25"
$env:REQUEST_CONCURRENCY = "120"
python loadtest-python/multi_tender_loadtest.py
```

El script imprime la distribución por tendero y falla con un mensaje claro si algún tendero no termina con 3/7/10 o si los montos difieren de $0/$12.000.

---

## Limpieza

Detén y elimina el contenedor de Postgres cuando termines:
```powershell
docker-compose down
```

---

## Notas técnicas

- Cada aceptación se procesa en una transacción `SERIALIZABLE` con `pg_advisory_xact_lock`, garantizando que las posiciones (1..n) sean únicas por tendero.
- Si Postgres devuelve `could not serialize access`, el servicio reintenta automáticamente hasta 8 veces con un breve backoff.
- `UPDATE ... RETURNING` se usa sobre `user_notebook_subscription` para conocer la posición aceptada y clasificar el incentivo sin condiciones de carrera.
- El monto (`amount`) se actualiza en el mismo `UPDATE`: posiciones 1–3 → $0, 4–10 → $12.000, ≥11 → $0.
- El índice parcial `uq_tx_pay_shopkeeper` impide duplicar incentivos para la misma deuda.

Con estos pasos puedes levantar el entorno, probar manualmente y ejecutar las pruebas de carga sencillas o masivas sin adivinar ningún dato. ¡Listo para experimentar!

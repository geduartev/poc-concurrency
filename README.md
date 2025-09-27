# PoC Concurrency

Objetivo: recibir aceptaciones de deuda de forma concurrente siguiendo unas reglas de estado y montos. Verificar que, si n aceptan al mismo tiempo, los primeros 3 queden sin un monto, los siguientes 7 reciban $12.000 y el resto no obtenga monto tampoco.

## Estructura del repositorio

```
poc-concurrency/
├── backend-nestjs/          # Microservicio NestJS + TypeORM
│   ├── src/                 # Código
│   ├── migrations/          # Migraciones TypeORM
│   ├── package.json         # Dependencias y scripts npm
│   └── ...
├── loadtest-python/         # Scripts Python para sembrado, pruebas concurrentes y verificación
├── sql/                     # Scripts tablas
├── docker-compose.yml       # Postgres
├── Makefile                 # Atajos de comandos
└── README.md                # Este documento
```

---

## Requisitos previos

1. **Docker Desktop** Correrlo para levantar Postgres.
2. **Node.js 20+**
3. **Python 3.10+** con `pip`. Para las pruebas de carga encontre a "pip" para los scripts.
4. (Opcional) **Git Bash** o **PowerShell**


---

## Paso 1 · Levantar Postgres con Docker

Validar `docker-compose.yml` con un contenedor de Postgres (usuario y contraseña `postgres`). Al iniciar el contenedor se crea automáticamente la base `poc_concurrency`.

```powershell
# Desde la raíz del repositorio
make up
```

Si no tienes `make` instalado puedes ejecutar lo mismo de forma manual:

```powershell
docker-compose up -d postgres
```

- El contenedor queda escuchando en `localhost:5432` y almacena los datos en un volumen.
- Para detenerlo más adelante usa `docker-compose down`.

---

## Paso 2 · Preparar el microservicio NestJS

1. **Copiar archivo de entorno** (contiene ejemplos de configuración TypeORM y API):
   ```powershell
   Copy-Item backend-nestjs/.env.example backend-nestjs/.env
   ```

2. **Instalar dependencias y compilar** (para instalar NestJS, TypeORM):
   ```powershell
   make migrate
   ```
   El comando anterior ejecuta internamente: `npm install`, `npm run build` y `npm run migration:run`.
   
   Si no tienes `make`, hazlo a mano:
   ```powershell
   cd backend-nestjs
   npm install
   npm run build
   npm run migration:run
   cd ..
   ```
   Nota: Este paso crea las tablas `account_notebook` y `user_notebook_subscription` en la base.

3. **Levantar el servicio**:
   ```powershell
   cd backend-nestjs
   npm run start:dev
   ```
---

## Paso 3 · Pruebas manuales con Postman

Necesitamos un par de datos para armar la petición: el `ID de la deuda` (UUID) y el `user_id_creditor` (UUID del tendero).

- **Método:** `PATCH`
- **URL:** `http://localhost:3000/account-notebook/<ID>/status`
  - Reemplaza `<ID>` por el UUID de la deuda que quieres aceptar (ejemplo `865343c6-839c-46f8-bd44-b741026709ab`).
- **Headers:**
  - `Content-Type: application/json`
  - `x-api-key` (solo si en `.env` activaste `API_KEY`).
- **Body (JSON):**
  ```json
  {
    "status": "ACCEPTED",
    "user_id_creditor": "<uuid-del-tendero>"
  }
  ```
  Donde `<uuid-del-tendero>` es el mismo `USER_ID_CREDITOR` que imprimió el script de seed.

La respuesta será algo como:
```json
{
  "ok": true,
  "incentive": "LimitCanPay",
  "txId": "..."  // sólo si aplica incentivo
}
```
---

## Paso 4 · Scripts Python (un tendero)

Todos los scripts están en `loadtest-python/`.

```powershell
python -m pip install -r loadtest-python/requirements.txt
```

### 4.1. Crear 20 deudas para un tendero

Prueba con 20 deudas. `account_notebook`, todas con `status='CREATED'` y `amount=0`. También imprime los IDs necesarios para las pruebas.

```powershell
python loadtest-python/seed_debts.py
```

Salida típica:
```
NOTEBOOK_IDS=uuid1,uuid2,...,uuid20
USER_ID_CREDITOR=uuid-del-tendero
ACCOUNT_ID_CREDITOR=uuid-de-la-cuenta
```
- **`NOTEBOOK_IDS`** es una lista de 20 UUID separada por comas. Representa cada deuda.
- **`USER_ID_CREDITOR`** es el tendero al que pertenecen todas las deudas.
- **`ACCOUNT_ID_CREDITOR`** no es indispensable para la prueba, pero se muestra por si lo necesitas en consultas posteriores.

### 4.2. Exportar variables de entorno

- **PowerShell** (ventanas modernas de Windows):
  ```powershell
  $env:NOTEBOOK_IDS = "uuid1,uuid2,..."
  $env:USER_ID_CREDITOR = "uuid-del-tendero"
  ```
- **CMD clásico**:
  ```cmd
  set NOTEBOOK_IDS=uuid1,uuid2,...
  set USER_ID_CREDITOR=uuid-del-tendero
  ```
- **Git Bash / WSL / Linux / macOS:**
  ```bash
  export NOTEBOOK_IDS="uuid1,uuid2,..."
  export USER_ID_CREDITOR="uuid-del-tendero"
  ```

### 4.3. Lanzar las 20 aceptaciones concurrentes

```powershell
python loadtest-python/concurrent_accept.py
```

¿Qué hace? Envía 20 `PATCH` casi simultáneos al backend usando `httpx` + `asyncio`, respeta reintentos ante errores 409/5xx y al final muestra cuántas deudas quedaron con cada incentivo.

De acuerdo a lo entendido:
```
LowerLimitToPay: 3
LimitCanPay: 7
HigherLimitToPay: 10
```

### 4.4. Verificar en la base

```powershell
python loadtest-python/verify_db.py
```

Para agrupar y verificar más rápido que en Postgresadmin `status_by_pay_shopkeeper`, confirmando 3/7/10.

---

## Paso 5 · Prueba de carga multi-tendero

Crea varios tenderos y lanza todas las aceptaciones al mismo tiempo: `loadtest-python/multi_tender_loadtest.py` 

```powershell
python loadtest-python/multi_tender_loadtest.py
```

### Configuración

Puedes controlar el comportamiento con variables de entorno:

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `TENDER_COUNT` | Número de tenderos que se generan | 20 |
| `DEBTS_PER_TENDER` | Deudas por tendero | 20 |
| `REQUEST_CONCURRENCY` | Máximo de peticiones simultáneas contra el API | 40 |
| `TENDER_CONCURRENCY` | Cuántos tenderos se procesan a la vez | 4 |
| `RESET_DB` | Si `true`, hace `TRUNCATE` antes de sembrar | true |
| `API_BASE` | URL base del backend (ej. `http://localhost:3000`) | `http://localhost:3000` |
| `API_KEY` | API key opcional | vacío |

Ejemplo en PowerShell para personalizarla:
```powershell
$env:TENDER_COUNT = "20000"
$env:DEBTS_PER_TENDER = "25"
$env:REQUEST_CONCURRENCY = "100"
$env:TENDER_CONCURRENCY = "20"
python loadtest-python/multi_tender_loadtest.py
```

Dejé lo siguiente:
- Imprima la distribución
- Aborta con un error descriptivo si no cumple  3/7/10 
- Aborta si el dinero no es 0/12.000 donde corresponde

---

## Limpieza

Cuando hayas terminado:

```powershell
docker-compose down
```
Esto detiene y elimina el contenedor de Postgres creado con Docker Compose.

---

## Notas técnicas

- EL LUNES MIRO  TODO: Validar si esto es ventajoso o no: Las transacciones usan nivel `SERIALIZABLE` combinado con `pg_advisory_xact_lock` para serializar las aceptaciones por tendero.
- TODO: probar si en un choque de concurrencia (`could not serialize access`), el servicio reintenta automáticamente con un backoff ligero.
- TODO: verificar como en un código de estrategia de migración si al utilizar `UPDATE ... RETURNING` sobre `user_notebook_subscription` para obtener la posición de aceptación (1..n). Así se decide el incentivo sin condiciones de carrera.
- TODO: Validar si el índice parcial `uq_tx_pay_shopkeeper` garantiza que no existan incentivos duplicados para una misma deuda.

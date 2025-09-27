PYTHON ?= python
NPM ?= npm
COMPOSE ?= docker-compose

export NOTEBOOK_IDS
export USER_ID_CREDITOR
export ACCOUNT_ID_CREDITOR
export API_BASE
export API_KEY
export PGHOST
export PGPORT
export PGDATABASE
export PGUSER
export PGPASSWORD
export DEBT_AMOUNT
export TENDER_COUNT
export DEBTS_PER_TENDER

.PHONY: up migrate seed test verify backend install-python test-multi

up:
	$(COMPOSE) up -d postgres

migrate:
	cd backend-nestjs && $(NPM) install && $(NPM) run build && $(NPM) run migration:run

install-python:
	$(PYTHON) -m pip install -r loadtest-python/requirements.txt

seed: install-python
	$(PYTHON) loadtest-python/seed_debts.py

test: install-python
	$(PYTHON) loadtest-python/concurrent_accept.py

test-multi: install-python
	$(PYTHON) loadtest-python/multi_tender_loadtest.py

verify: install-python
	$(PYTHON) loadtest-python/verify_db.py

backend:
	$(COMPOSE) up backend

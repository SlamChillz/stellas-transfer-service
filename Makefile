.PHONY: help install dev test lint docker-start docker-stop docker-test clean

# Default: show what you can run
help:
	@echo "Stellas — quick commands for reviewers"
	@echo ""
	@echo "  make install       Install dependencies (npm ci)"
	@echo "  make dev           Run app with hot reload"
	@echo "  make test          Run all tests"
	@echo "  make lint          Run ESLint"
	@echo "  make docker-start  Start app + DB in Docker"
	@echo "  make docker-stop   Stop Docker app + DB"
	@echo "  make docker-test   Run tests in Docker (CI-style)"
	@echo "  make clean         Remove dist/ and node_modules/"
	@echo ""

install:
	npm ci

dev:
	npm run dev

test:
	@docker compose --profile test run --rm test
	@npm test

lint:
	npm run lint

docker-start:
	docker compose --profile tools up -d --build

docker-stop:
	docker compose down

docker-test:
	docker compose --profile test build test && docker compose --profile test run --rm test

clean:
	rm -rf dist node_modules

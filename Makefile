VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_TIME ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS := -s -w \
	-X github.com/biswas-dev/learn/internal/version.Version=$(VERSION) \
	-X github.com/biswas-dev/learn/internal/version.GitCommit=$(COMMIT) \
	-X github.com/biswas-dev/learn/internal/version.BuildTime=$(BUILD_TIME)

.PHONY: dev dev-api dev-web build build-api build-web test docker clean

dev: dev-api dev-web

dev-api:
	LEARN_JWT_SECRET=dev-secret LEARN_DB_PATH=data/learn.db go run ./cmd/server

dev-web:
	cd frontend && npm run dev

build: build-web build-api

build-api:
	CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/learn ./cmd/server

build-web:
	cd frontend && npm ci && npm run build && npm run build.server

test:
	go test ./internal/...

docker:
	docker build \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_TIME=$(BUILD_TIME) \
		-t learn .

clean:
	rm -rf bin/ frontend/dist/ frontend/node_modules/ frontend/server/

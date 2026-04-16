## Stage 1: Build frontend
FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown
ENV VITE_APP_VERSION=${VERSION}
ENV VITE_GIT_COMMIT=${COMMIT}
ENV VITE_BUILD_TIME=${BUILD_TIME}
RUN npm run build && npm run build.server

## Stage 2: Build backend
FROM golang:1.26-alpine AS backend
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags "-s -w \
    -X github.com/biswas-dev/learn/internal/version.Version=${VERSION} \
    -X github.com/biswas-dev/learn/internal/version.GitCommit=${COMMIT} \
    -X github.com/biswas-dev/learn/internal/version.BuildTime=${BUILD_TIME}" \
    -o /learn ./cmd/server

## Stage 3: Runtime
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
COPY --from=backend /learn /usr/local/bin/learn
COPY --from=frontend /app/frontend/dist/ /app/frontend/dist/
VOLUME /data
ENV LEARN_DB_PATH=/data/learn.db
ENV LEARN_DRAW_DATA_DIR=/data/draw-data
ENV LEARN_IMAGES_DIR=/data/images
ENV LEARN_FRONTEND_DIST=/app/frontend/dist
EXPOSE 8080
ENTRYPOINT ["learn"]

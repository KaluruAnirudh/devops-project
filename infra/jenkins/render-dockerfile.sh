#!/usr/bin/env bash
set -euo pipefail

repo_dir="${1:?repository path is required}"
project_type="${2:?project type is required}"

if [[ -f "${repo_dir}/Dockerfile" ]]; then
  echo "${repo_dir}/Dockerfile"
  exit 0
fi

mkdir -p "${repo_dir}/.forgeops"
target_file="${repo_dir}/.forgeops/Dockerfile"

case "${project_type}" in
  node)
    cat > "${target_file}" <<'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build --if-present
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder /app /app
USER node
EXPOSE 3000
CMD ["npm", "start"]
EOF
    ;;
  java)
    cat > "${target_file}" <<'EOF'
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY . .
RUN if [ -f pom.xml ]; then \
      if [ -f mvnw ]; then chmod +x mvnw && ./mvnw -B -DskipTests package; else mvn -B -DskipTests package; fi; \
      cp target/*.jar /tmp/app.jar; \
    else \
      if [ -f gradlew ]; then chmod +x gradlew && ./gradlew build -x test; else gradle build -x test; fi; \
      cp build/libs/*.jar /tmp/app.jar; \
    fi

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /tmp/app.jar /app/app.jar
USER app
EXPOSE 8080
CMD ["java", "-jar", "/app/app.jar"]
EOF
    ;;
  python)
    cat > "${target_file}" <<'EOF'
FROM python:3.11-slim AS builder
WORKDIR /app
COPY . .
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir --prefix=/install -r requirements.txt; else pip install --no-cache-dir --prefix=/install .; fi

FROM python:3.11-slim
WORKDIR /app
RUN useradd --create-home appuser
COPY --from=builder /install /usr/local
COPY --from=builder /app /app
USER appuser
EXPOSE 8000
CMD ["python", "app.py"]
EOF
    ;;
  go)
    cat > "${target_file}" <<'EOF'
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o service .

FROM alpine:3.20
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/service /app/service
USER app
EXPOSE 8080
CMD ["/app/service"]
EOF
    ;;
  *)
    echo "Unknown project type: ${project_type}" >&2
    exit 1
    ;;
esac

echo "${target_file}"

#!/usr/bin/env bash
set -euo pipefail

repo_dir="${1:?repository path is required}"
project_type="${2:?project type is required}"
phase="${3:?phase is required}"

cd "${repo_dir}"

run_node() {
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi

  if [[ "${phase}" == "build" ]]; then
    npm run build --if-present
  else
    npm run test --if-present
  fi
}

run_java() {
  if [[ -f pom.xml ]]; then
    local mvn_cmd="mvn"
    if [[ -f mvnw ]]; then
      chmod +x mvnw
      mvn_cmd="./mvnw"
    fi

    if [[ "${phase}" == "build" ]]; then
      "${mvn_cmd}" -B -DskipTests package
    else
      "${mvn_cmd}" -B test
    fi
  else
    local gradle_cmd="gradle"
    if [[ -f gradlew ]]; then
      chmod +x gradlew
      gradle_cmd="./gradlew"
    fi

    if [[ "${phase}" == "build" ]]; then
      "${gradle_cmd}" assemble
    else
      "${gradle_cmd}" test
    fi
  fi
}

run_python() {
  python -m pip install --upgrade pip
  if [[ -f requirements.txt ]]; then
    python -m pip install -r requirements.txt
  fi

  if [[ "${phase}" == "build" ]]; then
    python -m compileall .
  elif [[ -d tests ]]; then
    python -m pytest || python -m unittest discover -s tests
  else
    echo "No Python tests directory detected, skipping."
  fi
}

run_go() {
  go mod download

  if [[ "${phase}" == "build" ]]; then
    go build ./...
  else
    go test ./...
  fi
}

case "${project_type}" in
  node) run_node ;;
  java) run_java ;;
  python) run_python ;;
  go) run_go ;;
  *)
    echo "Unknown project type: ${project_type}" >&2
    exit 1
    ;;
esac


#!/usr/bin/env bash
set -euo pipefail

repo_dir="${1:-.}"

if [[ -f "${repo_dir}/package.json" ]]; then
  echo "node"
elif [[ -f "${repo_dir}/pom.xml" || -f "${repo_dir}/build.gradle" || -f "${repo_dir}/build.gradle.kts" ]]; then
  echo "java"
elif [[ -f "${repo_dir}/requirements.txt" || -f "${repo_dir}/pyproject.toml" ]]; then
  echo "python"
elif [[ -f "${repo_dir}/go.mod" ]]; then
  echo "go"
else
  echo "Unsupported repository type. Expected Node, Java, Python, or Go project." >&2
  exit 1
fi


#!/usr/bin/env bash
set -euo pipefail

repo_dir="${1:?repository path is required}"
target_branch="${2:-main}"
run_id="${3:-manual}"

cd "${repo_dir}"
mkdir -p .forgeops

cat > .forgeops/deploy-metadata.json <<EOF
{
  "runId": "${run_id}",
  "version": "$(date +%Y.%m.%d.%H%M%S)",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "updatedBy": "forgeops-bot"
}
EOF

git config user.name "${AUTO_COMMIT_BOT_NAME:-forgeops-bot}"
git config user.email "${AUTO_COMMIT_BOT_EMAIL:-forgeops-bot@example.com}"
git add .forgeops/deploy-metadata.json

if git diff --cached --quiet; then
  echo "No deployment metadata changes detected."
  exit 0
fi

git commit -m "chore: update deployment metadata [skip-ci]"
git push origin "HEAD:${target_branch}"


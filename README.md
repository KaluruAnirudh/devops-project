# ForgeOps DevOps Automation Platform

ForgeOps is a modular DevOps automation platform built around a React frontend, an Express orchestration API, Jenkins for CI/CD execution, GitHub OAuth and repository integration, and Kubernetes-based self-healing deployment workflows.

## What the platform does

1. Users register and log in with JWT-based auth.
2. Users connect GitHub through OAuth.
3. The dashboard lists repositories and saves the selected repo.
4. The backend auto-configures a GitHub webhook for that repository.
5. Users trigger Jenkins pipelines manually, and GitHub push events can trigger them automatically.
6. Jenkins detects the project type, builds and tests it, generates or uses a Dockerfile, pushes images, deploys to Kubernetes, verifies rollout health, and rolls back on failure.
7. The dashboard streams pipeline status and logs over WebSockets.

## Repository layout

```text
frontend/              React dashboard
backend/               Express API, auth, GitHub OAuth, Jenkins orchestration
infra/jenkins/         CI/CD helper scripts
infra/k8s/             Kubernetes manifests
infra/docker/          Runtime config for containerized services
docs/                  Architecture and execution flow
Jenkinsfile            Jenkins pipeline definition
docker-compose.yml     Local platform bootstrap
```

## Frontend

- React + Vite
- Auth pages for login and registration
- Dashboard with GitHub connect, repository selection, pipeline trigger, stage cards, deployment status, and log stream
- WebSocket listener for live pipeline updates

## Backend

- Express API with JWT auth
- File-backed persistence for users and pipeline state
- Encrypted GitHub token storage using AES-256-GCM
- GitHub OAuth callback and repository listing
- GitHub webhook provisioning and webhook event processing
- Jenkins build trigger, queue resolution, status polling, and console log retrieval

## DevOps engine

- Jenkins declarative pipeline
- Language detection for Node.js, Java, Python, and Go
- Retry handling with max three attempts on build, test, containerize, and deploy stages
- Docker image build and push
- Kubernetes rolling deployment
- Self-healing verification using `kubectl rollout status`
- Automatic rollback using `kubectl rollout undo`
- Bot-driven deployment metadata commit using `[skip-ci]` to prevent loops

## Quick start

1. Copy `backend/.env.example` to `backend/.env` and fill in GitHub, Jenkins, Docker registry, and cluster settings.
   For Jenkins pipeline checkout and image push, set `GITHUB_PAT`, `GITHUB_USERNAME`, `REGISTRY_USERNAME`, and `REGISTRY_PASSWORD`. OAuth app credentials alone are not enough for Jenkins SCM access.
2. Copy `frontend/.env.example` to `frontend/.env` if you need a custom API URL.
3. Install dependencies:

```bash
npm install
```

4. Run the API and frontend:

```bash
npm run dev:backend
npm run dev:frontend
```

5. Or bring up the local container stack:

```bash
docker compose up --build
```

## Production notes

- Replace the file-backed store with PostgreSQL or another managed database before high-scale production rollout.
- Expose the backend on a public HTTPS URL so GitHub OAuth callbacks and repository webhooks can reach it.
- Jenkins bootstrap will auto-create `github-pat` and `registry-creds` from the env vars above when Jenkins starts.
- Use Kubernetes secrets or an external secret manager instead of plain env files in production.

See [Architecture](docs/architecture.md) for the end-to-end flow and control-plane design.

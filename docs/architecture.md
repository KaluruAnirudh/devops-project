# Architecture Flow

## 1. User experience flow

1. A user registers or logs in through the React frontend.
2. The frontend sends credentials to the Express API and receives a JWT.
3. The frontend stores the JWT locally and uses it for all subsequent API calls.
4. The user clicks `Connect GitHub`.
5. The backend generates a GitHub OAuth authorization URL with a signed state token.
6. GitHub redirects back to the backend callback, which exchanges the code for an access token and stores the encrypted token for that user.
7. The user loads repositories, selects one, and the backend creates a GitHub webhook for push events.
8. The user triggers a pipeline manually or pushes code to trigger it automatically.
9. The backend calls Jenkins `buildWithParameters`, creates a pipeline record, and starts polling Jenkins.
10. The frontend receives run updates and logs through REST refreshes plus WebSocket events.

## 2. Frontend to backend contract

The frontend talks only to the backend API:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/github/connect`
- `GET /api/github/repositories`
- `POST /api/github/select`
- `GET /api/pipelines`
- `POST /api/pipelines/trigger`
- `GET /api/pipelines/:pipelineId`
- `GET /api/pipelines/:pipelineId/logs`
- `WS /ws/pipelines`

The UI never talks directly to GitHub or Jenkins. That keeps secrets and tokens on the server side.

## 3. Backend orchestration responsibilities

The backend is the control plane for the platform.

- Auth: issues JWTs and validates protected routes.
- GitHub integration: generates OAuth URL, exchanges tokens, lists repositories, creates webhooks.
- Secret handling: encrypts stored GitHub tokens with AES-256-GCM.
- Pipeline orchestration: triggers Jenkins and maps Jenkins build state into dashboard-friendly stage state.
- Event processing: receives GitHub push webhooks and auto-triggers Jenkins unless the commit includes `[skip-ci]`.
- Live updates: broadcasts pipeline updates to authenticated WebSocket clients.

## 4. Jenkins pipeline flow

The root `Jenkinsfile` is parameterized so the backend can pass a repository, branch, image name, and namespace.

Stages:

1. `Checkout`
2. `Detect`
3. `Build`
4. `Test`
5. `Containerize`
6. `Auto Commit Metadata`
7. `Deploy`
8. `Verify`

The helper scripts under `infra/jenkins/` handle language detection, build/test execution, Dockerfile generation, deployment metadata commits, and self-healing rollout checks.

## 5. GitHub integration design

GitHub OAuth scopes include:

- `repo`
- `read:user`
- `user:email`
- `admin:repo_hook`

That enables:

- repository discovery
- user identity lookup
- webhook creation

Webhook behavior:

- GitHub sends push events to `/api/webhooks/github`
- the backend verifies the webhook HMAC
- the backend ignores bot commits carrying `[skip-ci]`
- otherwise it triggers a new Jenkins run for the bound repository

## 6. Self-healing deployment design

Self-healing happens in the deployment verification path:

1. Jenkins applies Kubernetes Deployment and Service manifests.
2. The platform waits for `kubectl rollout status`.
3. If the rollout fails or times out, the pipeline enters self-heal mode.
4. Jenkins runs `kubectl rollout undo`.
5. The pipeline waits again for the previous healthy ReplicaSet to stabilize.
6. The log stream emits stage markers so the dashboard can show verify and self-heal outcomes.

Kubernetes resilience settings included in the manifests:

- rolling updates
- readiness probes
- liveness probes
- `restartPolicy: Always`
- limited revision history

## 7. Security model

- JWT auth for platform sessions
- encrypted GitHub access tokens at rest
- webhook signature validation
- secrets loaded from environment variables
- no hardcoded credentials in code
- frontend isolated from Jenkins and GitHub secrets
- rollback and deployment actions centralized in Jenkins

## 8. Scalability direction

The current implementation is structured for growth:

- frontend and backend are separate deployable units
- Jenkins is an external execution engine
- the backend service layer can be moved from file storage to PostgreSQL without changing the UI
- WebSocket broadcasting can be moved behind Redis or another pub/sub layer for horizontal scale
- GitHub and Jenkins integrations are isolated behind service modules

## 9. End-to-end execution example

1. A developer pushes to `main`.
2. GitHub sends the push webhook to the backend.
3. The backend validates the signature and creates a pipeline record.
4. The backend calls Jenkins with repository and deployment parameters.
5. Jenkins clones the repository and detects the runtime.
6. Jenkins builds and tests the code with retries.
7. Jenkins builds and pushes the container image.
8. Jenkins updates deployment metadata and pushes a `[skip-ci]` commit using the bot account.
9. Jenkins deploys to Kubernetes.
10. Jenkins verifies rollout health.
11. If verification fails, Jenkins rolls back automatically.
12. The backend polls Jenkins, normalizes status, and streams updates to the dashboard.

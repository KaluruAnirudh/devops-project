import dotenv from "dotenv";

dotenv.config();

const fallbackSecret = "local-dev-secret-change-me";

const splitList = (value, fallback = []) =>
  value ? value.split(",").map((item) => item.trim()).filter(Boolean) : fallback;

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  publicApiUrl: process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`,
  jwtSecret: process.env.JWT_SECRET || fallbackSecret,
  encryptionKey: process.env.ENCRYPTION_KEY || fallbackSecret,
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  githubScopes: splitList(process.env.GITHUB_OAUTH_SCOPES, [
    "repo",
    "read:user",
    "user:email",
    "admin:repo_hook"
  ]),
  webhookSecret: process.env.WEBHOOK_SECRET || fallbackSecret,
  jenkinsUrl: (process.env.JENKINS_URL || "http://localhost:8080").replace(/\/$/, ""),
  jenkinsUser: process.env.JENKINS_USER || "admin",
  jenkinsApiToken: process.env.JENKINS_API_TOKEN || "",
  jenkinsJobName: process.env.JENKINS_JOB_NAME || "repo-cicd-engine",
  dockerRegistry: process.env.DOCKER_REGISTRY || "ghcr.io",
  k8sNamespace: process.env.K8S_NAMESPACE || "devops-platform",
  autoCommitBotName: process.env.AUTO_COMMIT_BOT_NAME || "devops-bot",
  autoCommitBotEmail: process.env.AUTO_COMMIT_BOT_EMAIL || "devops-bot@example.com"
};

export const isProduction = env.nodeEnv === "production";

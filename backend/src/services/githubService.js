import axios from "axios";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { signToken, verifyToken } from "../utils/jwt.js";

class GitHubService {
  getAuthorizationUrl(userId) {
    const state = signToken({ userId, provider: "github" }, "10m");
    const redirectUri = `${env.publicApiUrl}/api/github/callback`;
    const params = new URLSearchParams({
      client_id: env.githubClientId,
      redirect_uri: redirectUri,
      scope: env.githubScopes.join(" "),
      state
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    const redirectUri = `${env.publicApiUrl}/api/github/callback`;
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: env.githubClientId,
        client_secret: env.githubClientSecret,
        code,
        redirect_uri: redirectUri
      },
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    return response.data.access_token;
  }

  async fetchUser(accessToken) {
    const response = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json"
      }
    });

    return response.data;
  }

  async listRepositories(accessToken) {
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json"
      },
      params: {
        sort: "updated",
        per_page: 100
      }
    });

    return response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      cloneUrl: repo.clone_url,
      htmlUrl: repo.html_url
    }));
  }

  async ensureWebhook(accessToken, repository) {
    const [owner, repo] = repository.fullName.split("/");
    const webhookUrl = `${env.publicApiUrl}/api/webhooks/github`;
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: "web",
        active: true,
        events: ["push", "pull_request"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: env.webhookSecret,
          insecure_ssl: "0"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json"
        },
        validateStatus: (status) => status < 500
      }
    );

    if (response.status === 201 || response.status === 200) {
      return response.data;
    }

    if (response.status === 422) {
      const hooksResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json"
          }
        }
      );

      return hooksResponse.data.find((hook) => hook.config?.url === webhookUrl) || null;
    }

    throw new Error("Failed to configure repository webhook.");
  }

  verifyOauthState(state) {
    return verifyToken(state);
  }

  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!signatureHeader) {
      return false;
    }

    const digest = `sha256=${crypto
      .createHmac("sha256", env.webhookSecret)
      .update(rawBody)
      .digest("hex")}`;

    if (digest.length !== signatureHeader.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
  }
}

export const githubService = new GitHubService();

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const buildHeaders = (token, isJson = true) => {
  const headers = {};

  if (isJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const apiRequest = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: buildHeaders(token, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
};

export const api = {
  baseUrl: API_URL,
  async register(form) {
    return apiRequest("/api/auth/register", { method: "POST", body: form });
  },
  async login(form) {
    return apiRequest("/api/auth/login", { method: "POST", body: form });
  },
  async me(token) {
    return apiRequest("/api/auth/me", { token });
  },
  async getGithubConnectUrl(token) {
    return apiRequest("/api/github/connect", { token });
  },
  async listRepositories(token) {
    return apiRequest("/api/github/repositories", { token });
  },
  async selectRepository(token, repository) {
    return apiRequest("/api/github/select", {
      method: "POST",
      token,
      body: { repository }
    });
  },
  async listPipelines(token) {
    return apiRequest("/api/pipelines", { token });
  },
  async triggerPipeline(token, repository) {
    return apiRequest("/api/pipelines/trigger", {
      method: "POST",
      token,
      body: repository ? { repository } : {}
    });
  },
  async getPipeline(token, pipelineId) {
    return apiRequest(`/api/pipelines/${pipelineId}`, { token });
  },
  async getLogs(token, pipelineId) {
    return apiRequest(`/api/pipelines/${pipelineId}/logs`, { token });
  }
};

export const getPipelineWebSocketUrl = (token) => {
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/ws/pipelines?token=${encodeURIComponent(token)}`;
};


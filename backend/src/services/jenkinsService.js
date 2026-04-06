import axios from "axios";
import { env } from "../config/env.js";

class JenkinsService {
  constructor() {
    this.client = axios.create({
      baseURL: env.jenkinsUrl,
      auth: {
        username: env.jenkinsUser,
        password: env.jenkinsApiToken
      },
      timeout: 20000
    });
    this.cachedCrumb = null;
  }

  async getCrumb() {
    if (this.cachedCrumb) {
      return this.cachedCrumb;
    }

    const response = await this.client.get("/crumbIssuer/api/json", {
      validateStatus: (status) => status < 500
    });

    if (response.status === 404) {
      return null;
    }

    this.cachedCrumb = {
      field: response.data.crumbRequestField,
      value: response.data.crumb
    };

    return this.cachedCrumb;
  }

  async triggerPipeline(params) {
    const crumb = await this.getCrumb();
    const headers = {};

    if (crumb) {
      headers[crumb.field] = crumb.value;
    }

    const response = await this.client.post(
      `/job/${env.jenkinsJobName}/buildWithParameters`,
      null,
      {
        headers,
        params,
        validateStatus: (status) => status < 500
      }
    );

    if (response.status >= 400) {
      throw new Error(`Jenkins rejected the build trigger with status ${response.status}.`);
    }

    return {
      queueLocation: response.headers.location || null
    };
  }

  async resolveQueue(queueLocation) {
    if (!queueLocation) {
      return null;
    }

    const response = await axios.get(`${queueLocation}api/json`, {
      auth: {
        username: env.jenkinsUser,
        password: env.jenkinsApiToken
      },
      validateStatus: (status) => status < 500
    });

    if (response.status >= 400) {
      return null;
    }

    return response.data.executable?.number || null;
  }

  async getBuildStatus(buildNumber) {
    const response = await this.client.get(
      `/job/${env.jenkinsJobName}/${buildNumber}/api/json`,
      {
        validateStatus: (status) => status < 500
      }
    );

    if (response.status >= 400) {
      return null;
    }

    return response.data;
  }

  async getConsoleLog(buildNumber) {
    const response = await this.client.get(
      `/job/${env.jenkinsJobName}/${buildNumber}/consoleText`,
      {
        responseType: "text",
        transformResponse: [(data) => data],
        validateStatus: (status) => status < 500
      }
    );

    if (response.status >= 400) {
      return "";
    }

    return response.data || "";
  }
}

export const jenkinsService = new JenkinsService();

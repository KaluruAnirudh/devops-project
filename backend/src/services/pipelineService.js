import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import { dataStore } from "../models/dataStore.js";
import { env } from "../config/env.js";
import { jenkinsService } from "./jenkinsService.js";

const defaultStages = [
  { key: "checkout", label: "Checkout" },
  { key: "detect", label: "Detect" },
  { key: "build", label: "Build" },
  { key: "test", label: "Test" },
  { key: "containerize", label: "Containerize" },
  { key: "deploy", label: "Deploy" },
  { key: "verify", label: "Verify" },
  { key: "selfheal", label: "Self Heal" }
];

const stageMarker = /\[stage:(?<stage>[a-z-]+)\]\[status:(?<status>[a-z-]+)\]/gi;

const normalizeImageSegment = (value, fallback) => {
  const sanitized = (value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || fallback;
};

const buildDockerImage = (repository) => {
  const registryBase = (env.dockerRegistry || "ghcr.io").replace(/\/$/, "");
  const [repositoryOwner = "app"] = (repository.fullName || "").split("/");
  const ownerSegment = normalizeImageSegment(repositoryOwner, "app");
  const nameSegment = normalizeImageSegment(repository.name, "application");
  const hostOnlyRegistry = !registryBase.includes("/");
  const placeholderRegistry = /\/(?:your-org|example)$/i.test(registryBase);

  if (hostOnlyRegistry) {
    return `${registryBase}/${ownerSegment}/${nameSegment}`;
  }

  if (placeholderRegistry) {
    const registryHost = registryBase.split("/")[0];
    return `${registryHost}/${ownerSegment}/${nameSegment}`;
  }

  return `${registryBase}/${nameSegment}`;
};

const buildStageList = (consoleLog, outcome) => {
  stageMarker.lastIndex = 0;
  const stageStates = new Map(defaultStages.map((stage) => [stage.key, "pending"]));
  let match = stageMarker.exec(consoleLog);

  while (match) {
    stageStates.set(match.groups.stage, match.groups.status === "start" ? "running" : match.groups.status);
    match = stageMarker.exec(consoleLog);
  }

  if (outcome === "SUCCESS") {
    for (const stage of defaultStages) {
      if (stageStates.get(stage.key) === "running") {
        stageStates.set(stage.key, "success");
      }
    }
  }

  if (outcome === "FAILURE") {
    const runningStage = defaultStages.find((stage) => stageStates.get(stage.key) === "running");
    if (runningStage) {
      stageStates.set(runningStage.key, "failed");
    }
  }

  return defaultStages.map((stage) => ({
    ...stage,
    status: stageStates.get(stage.key) || "pending"
  }));
};

class PipelineService {
  constructor() {
    this.events = new EventEmitter();
  }

  async createAndTrigger(userId, repository, source = "manual") {
    const runId = uuidv4();
    const pipeline = {
      id: runId,
      userId,
      repository,
      source,
      status: "queued",
      buildNumber: null,
      queueLocation: null,
      logs: "",
      stages: defaultStages.map((stage) => ({ ...stage, status: "pending" })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetEnvironment: env.k8sNamespace
    };

    await dataStore.update((db) => {
      db.pipelines.unshift(pipeline);
      return db;
    });

    try {
      const triggerResult = await jenkinsService.triggerPipeline({
        RUN_ID: runId,
        REPOSITORY_URL: repository.cloneUrl,
        REPOSITORY_NAME: repository.fullName,
        DEFAULT_BRANCH: repository.defaultBranch || "main",
        DOCKER_IMAGE: buildDockerImage(repository),
        K8S_NAMESPACE: env.k8sNamespace
      });

      await dataStore.update((db) => {
        const entry = db.pipelines.find((item) => item.id === runId);
        if (entry) {
          entry.queueLocation = triggerResult.queueLocation;
          entry.updatedAt = new Date().toISOString();
        }
        return db;
      });
    } catch (error) {
      pipeline.status = "failure";
      pipeline.logs = error.message;
      pipeline.updatedAt = new Date().toISOString();
      await this.persist(pipeline);
      this.events.emit("pipeline.updated", pipeline);
      throw error;
    }

    return this.getById(userId, runId);
  }

  async resolveRuntimeState(pipeline) {
    if (!pipeline) {
      return null;
    }

    if (!pipeline.buildNumber && pipeline.queueLocation) {
      const buildNumber = await jenkinsService.resolveQueue(pipeline.queueLocation);

      if (buildNumber) {
        pipeline.buildNumber = buildNumber;
        pipeline.status = "running";
      }
    }

    if (pipeline.buildNumber) {
      const [buildInfo, consoleLog] = await Promise.all([
        jenkinsService.getBuildStatus(pipeline.buildNumber),
        jenkinsService.getConsoleLog(pipeline.buildNumber)
      ]);

      if (buildInfo) {
        pipeline.status = buildInfo.building
          ? "running"
          : (buildInfo.result || "UNKNOWN").toLowerCase();
        pipeline.logs = consoleLog;
        pipeline.stages = buildStageList(consoleLog, buildInfo.result);
        pipeline.duration = buildInfo.duration;
        pipeline.url = buildInfo.url;
      }
    }

    pipeline.updatedAt = new Date().toISOString();
    await this.persist(pipeline);
    this.events.emit("pipeline.updated", pipeline);
    return pipeline;
  }

  async persist(pipeline) {
    await dataStore.update((db) => {
      const index = db.pipelines.findIndex((entry) => entry.id === pipeline.id);

      if (index >= 0) {
        db.pipelines[index] = pipeline;
      }

      return db;
    });
  }

  async listForUser(userId) {
    const db = await dataStore.read();
    const pipelines = db.pipelines.filter((entry) => entry.userId === userId).slice(0, 10);
    const refreshed = [];

    for (const pipeline of pipelines) {
      refreshed.push(await this.resolveRuntimeState({ ...pipeline }));
    }

    return refreshed;
  }

  async getById(userId, pipelineId) {
    const db = await dataStore.read();
    const pipeline = db.pipelines.find(
      (entry) => entry.id === pipelineId && entry.userId === userId
    );

    if (!pipeline) {
      return null;
    }

    return this.resolveRuntimeState({ ...pipeline });
  }

  async getLogs(userId, pipelineId) {
    const pipeline = await this.getById(userId, pipelineId);
    return pipeline?.logs || "";
  }

  async handlePushEvent(fullName) {
    const db = await dataStore.read();
    const matchedUsers = db.users.filter(
      (user) => user.github?.selectedRepository?.fullName === fullName
    );

    const runs = [];

    for (const user of matchedUsers) {
      runs.push(await this.createAndTrigger(user.id, user.github.selectedRepository, "webhook"));
    }

    return runs;
  }
}

export const pipelineService = new PipelineService();

import { Router } from "express";
import { pipelineController } from "../controllers/pipelineController.js";
import { requireAuth } from "../middleware/auth.js";

export const pipelineRoutes = Router();

pipelineRoutes.get("/", requireAuth, pipelineController.list);
pipelineRoutes.post("/trigger", requireAuth, pipelineController.trigger);
pipelineRoutes.get("/:pipelineId", requireAuth, pipelineController.details);
pipelineRoutes.get("/:pipelineId/logs", requireAuth, pipelineController.logs);


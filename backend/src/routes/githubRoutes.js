import { Router } from "express";
import { githubController } from "../controllers/githubController.js";
import { requireAuth } from "../middleware/auth.js";

export const githubRoutes = Router();

githubRoutes.get("/connect", requireAuth, githubController.connect);
githubRoutes.get("/callback", githubController.callback);
githubRoutes.get("/repositories", requireAuth, githubController.repositories);
githubRoutes.post("/select", requireAuth, githubController.selectRepository);


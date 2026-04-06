import { Router } from "express";
import express from "express";
import { webhookController } from "../controllers/webhookController.js";
import { githubService } from "../services/githubService.js";

export const webhookRoutes = Router();

webhookRoutes.post(
  "/github",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    const signature = req.headers["x-hub-signature-256"];

    if (!githubService.verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({ message: "Invalid webhook signature." });
    }

    return next();
  },
  webhookController.github
);


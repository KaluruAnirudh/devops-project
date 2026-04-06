import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "node:http";
import morgan from "morgan";
import { WebSocketServer } from "ws";
import { authRoutes } from "./routes/authRoutes.js";
import { githubRoutes } from "./routes/githubRoutes.js";
import { pipelineRoutes } from "./routes/pipelineRoutes.js";
import { webhookRoutes } from "./routes/webhookRoutes.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { pipelineService } from "./services/pipelineService.js";
import { verifyToken } from "./utils/jwt.js";

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: false
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use("/api/webhooks", webhookRoutes);
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.redirect(env.frontendUrl);
});

app.get("/api", (req, res) => {
  res.json({
    name: "ForgeOps API",
    status: "ok",
    frontend: env.frontendUrl,
    health: "/api/health"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/pipelines", pipelineRoutes);
app.use(errorHandler);

const wss = new WebSocketServer({ server, path: "/ws/pipelines" });

wss.on("connection", (socket, request) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    const payload = verifyToken(token);
    socket.userId = payload.sub;
    socket.send(JSON.stringify({ type: "connected" }));
  } catch (error) {
    socket.close(4002, "Unauthorized");
  }
});

pipelineService.events.on("pipeline.updated", (pipeline) => {
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.userId === pipeline.userId) {
      client.send(JSON.stringify({ type: "pipeline.updated", payload: pipeline }));
    }
  }
});

server.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

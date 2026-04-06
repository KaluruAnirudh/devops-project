import { pipelineService } from "../services/pipelineService.js";

export const webhookController = {
  async github(req, res, next) {
    try {
      const eventName = req.headers["x-github-event"];

      if (eventName === "ping") {
        return res.json({ ok: true });
      }

      if (eventName === "push") {
        const payload = JSON.parse(req.body.toString("utf8"));
        const commits = payload.commits || [];
        const skipCi = commits.some((commit) => /\[skip-ci\]/i.test(commit.message));

        if (!skipCi) {
          await pipelineService.handlePushEvent(payload.repository.full_name);
        }
      }

      return res.json({ accepted: true });
    } catch (error) {
      return next(error);
    }
  }
};

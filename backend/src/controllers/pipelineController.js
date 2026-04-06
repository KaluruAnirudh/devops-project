import { pipelineService } from "../services/pipelineService.js";
import { userService } from "../services/userService.js";

export const pipelineController = {
  async list(req, res, next) {
    try {
      const pipelines = await pipelineService.listForUser(req.user.id);
      return res.json({ pipelines });
    } catch (error) {
      return next(error);
    }
  },

  async trigger(req, res, next) {
    try {
      const repository = req.body.repository || req.user.github?.selectedRepository;

      if (!repository) {
        return res.status(400).json({ message: "Select a GitHub repository first." });
      }

      const pipeline = await pipelineService.createAndTrigger(req.user.id, repository);
      const refreshedUser = await userService.getById(req.user.id);

      return res.status(201).json({
        pipeline,
        user: userService.sanitize(refreshedUser)
      });
    } catch (error) {
      return next(error);
    }
  },

  async details(req, res, next) {
    try {
      const pipeline = await pipelineService.getById(req.user.id, req.params.pipelineId);

      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline run not found." });
      }

      return res.json({ pipeline });
    } catch (error) {
      return next(error);
    }
  },

  async logs(req, res, next) {
    try {
      const logs = await pipelineService.getLogs(req.user.id, req.params.pipelineId);
      return res.json({ logs });
    } catch (error) {
      return next(error);
    }
  }
};


import { env } from "../config/env.js";
import { githubService } from "../services/githubService.js";
import { userService } from "../services/userService.js";

export const githubController = {
  async connect(req, res) {
    return res.json({
      url: githubService.getAuthorizationUrl(req.user.id)
    });
  },

  async callback(req, res, next) {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.redirect(`${env.frontendUrl}/dashboard?github=failed`);
      }

      const statePayload = githubService.verifyOauthState(state);
      const accessToken = await githubService.exchangeCodeForToken(code);
      const githubProfile = await githubService.fetchUser(accessToken);
      await userService.attachGithubAccount(statePayload.userId, githubProfile, accessToken);

      return res.redirect(`${env.frontendUrl}/dashboard?github=connected`);
    } catch (error) {
      return next(error);
    }
  },

  async repositories(req, res, next) {
    try {
      const accessToken = await userService.getGithubAccessToken(req.user.id);

      if (!accessToken) {
        return res.status(400).json({ message: "Connect GitHub before browsing repositories." });
      }

      const repositories = await githubService.listRepositories(accessToken);
      return res.json({ repositories });
    } catch (error) {
      return next(error);
    }
  },

  async selectRepository(req, res, next) {
    try {
      const accessToken = await userService.getGithubAccessToken(req.user.id);

      if (!accessToken) {
        return res.status(400).json({ message: "Connect GitHub before selecting a repository." });
      }

      const repository = req.body.repository;

      if (!repository?.fullName || !repository?.cloneUrl || !repository?.name) {
        return res.status(400).json({ message: "A valid repository selection is required." });
      }

      const hook = await githubService.ensureWebhook(accessToken, repository);
      const user = await userService.saveSelectedRepository(req.user.id, {
        ...repository,
        installationWebhook: hook?.config?.url || null
      });

      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  }
};

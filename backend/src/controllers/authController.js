import { signToken } from "../utils/jwt.js";
import { userService } from "../services/userService.js";

const issueSession = (user) => ({
  token: signToken({ sub: user.id, email: user.email }),
  user
});

export const authController = {
  async register(req, res, next) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required." });
      }

      const user = await userService.register({ name, email, password });
      return res.status(201).json(issueSession(user));
    } catch (error) {
      return next(error);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await userService.validateCredentials(email, password);

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      return res.json(issueSession(userService.sanitize(user)));
    } catch (error) {
      return next(error);
    }
  },

  async me(req, res) {
    return res.json({ user: userService.sanitize(req.user) });
  }
};


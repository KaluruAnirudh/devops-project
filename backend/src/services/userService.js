import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { dataStore } from "../models/dataStore.js";
import { decrypt, encrypt } from "../utils/encryption.js";

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
  github: {
    connected: Boolean(user.github?.accessToken),
    username: user.github?.username || null,
    avatarUrl: user.github?.avatarUrl || null,
    connectedAt: user.github?.connectedAt || null,
    selectedRepository: user.github?.selectedRepository || null
  }
});

class UserService {
  async getById(id) {
    const db = await dataStore.read();
    return db.users.find((user) => user.id === id) || null;
  }

  async getByEmail(email) {
    const db = await dataStore.read();
    return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async register({ name, email, password }) {
    const existingUser = await this.getByEmail(email);

    if (existingUser) {
      const error = new Error("An account with that email already exists.");
      error.statusCode = 409;
      error.expose = true;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      name,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
      github: {
        accessToken: "",
        username: "",
        avatarUrl: "",
        connectedAt: null,
        selectedRepository: null
      }
    };

    await dataStore.update((db) => {
      db.users.push(user);
      return db;
    });

    return sanitizeUser(user);
  }

  async validateCredentials(email, password) {
    const user = await this.getByEmail(email);

    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    return passwordMatches ? user : null;
  }

  async attachGithubAccount(userId, githubProfile, accessToken) {
    let updatedUser = null;

    await dataStore.update((db) => {
      const user = db.users.find((entry) => entry.id === userId);

      if (!user) {
        return db;
      }

      user.github = {
        ...user.github,
        accessToken: encrypt(accessToken),
        username: githubProfile.login,
        avatarUrl: githubProfile.avatar_url,
        connectedAt: new Date().toISOString()
      };
      updatedUser = user;
      return db;
    });

    return updatedUser ? sanitizeUser(updatedUser) : null;
  }

  async getGithubAccessToken(userId) {
    const user = await this.getById(userId);
    return user?.github?.accessToken ? decrypt(user.github.accessToken) : "";
  }

  async saveSelectedRepository(userId, repository) {
    let updatedUser = null;

    await dataStore.update((db) => {
      const user = db.users.find((entry) => entry.id === userId);

      if (!user) {
        return db;
      }

      user.github = {
        ...user.github,
        selectedRepository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.fullName,
          cloneUrl: repository.cloneUrl,
          defaultBranch: repository.defaultBranch,
          private: repository.private,
          installationWebhook: repository.installationWebhook || null,
          updatedAt: new Date().toISOString()
        }
      };
      updatedUser = user;
      return db;
    });

    return updatedUser ? sanitizeUser(updatedUser) : null;
  }

  sanitize(user) {
    return sanitizeUser(user);
  }
}

export const userService = new UserService();


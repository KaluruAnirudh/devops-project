import crypto from "node:crypto";
import { env } from "../config/env.js";

const deriveKey = (input) => {
  if (/^[0-9a-fA-F]{64}$/.test(input)) {
    return Buffer.from(input, "hex");
  }

  return crypto.createHash("sha256").update(input).digest();
};

const key = deriveKey(env.encryptionKey);

export const encrypt = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

export const decrypt = (payload) => {
  if (!payload) {
    return "";
  }

  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};


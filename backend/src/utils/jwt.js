import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signToken = (payload, expiresIn = "12h") =>
  jwt.sign(payload, env.jwtSecret, { expiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);


import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const generateAccessToken = (userId, email) => {
  return jwt.sign({ userId, email }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry,
  });
};

export const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

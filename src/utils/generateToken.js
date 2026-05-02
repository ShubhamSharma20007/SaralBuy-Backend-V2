import jwt from 'jsonwebtoken';

export const generateToken = payload =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_SECRET_EXPIRY });

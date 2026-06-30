import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function signToken(payload) {
  return jwt.sign(payload, config.api.jwtSecret, { expiresIn: config.api.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.api.jwtSecret);
}

// Express middleware: require a valid JWT
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Express middleware factory: require one of the given roles (RBAC)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
}

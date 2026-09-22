import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.ts';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'Employee' | 'ProjectOwner' | 'CEO';
  department: string | null;
  avatarUrl: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Server-side RBAC & Authentication Middleware
 * Reads user identifier from Authorization header (Bearer <userId>) or cookie (ff_user_id).
 * If none provided, defaults to default user (CEO Eleanor Foley or Marcus Vance) for initial load.
 */
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  let userId: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  } else if (req.headers['x-user-id']) {
    userId = String(req.headers['x-user-id']).trim();
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      if (name === 'ff_user_id' && val) {
        userId = decodeURIComponent(val);
        break;
      }
    }
  }

  try {
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    }

    if (user) {
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as 'Employee' | 'ProjectOwner' | 'CEO',
        department: user.department,
        avatarUrl: user.avatarUrl,
      };
    }
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    next();
  }
}

/**
 * Enforce Authentication
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }
  next();
}

/**
 * Enforce RBAC: Project Owner or CEO
 */
export function requireOwnerOrCEO(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  if (req.user.role !== 'CEO' && req.user.role !== 'ProjectOwner') {
    return res.status(403).json({
      error: 'Forbidden: Only Project Owners or CEO have permission to perform this action.',
    });
  }

  next();
}

/**
 * Enforce RBAC: CEO only
 */
export function requireCEO(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  if (req.user.role !== 'CEO') {
    return res.status(403).json({
      error: 'Forbidden: This action requires CEO administrative authority.',
    });
  }

  next();
}

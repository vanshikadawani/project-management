import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { AuthRequest, requireAuth } from '../auth.ts';

const router = Router();

/**
 * GET /api/users
 * Returns all users eligible to be assigned tasks (Employees and ProjectOwners).
 * Only authenticated users can access this.
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatarUrl: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    res.json(users);
  } catch (error: any) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

export default router;

import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { AuthRequest } from '../auth.ts';

const router = Router();

// GET /api/auth/me — Retrieve authenticated user profile and directory
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatarUrl: true,
      },
      orderBy: { name: 'asc' },
    });

    const currentUser = req.user || null;

    res.json({
      currentUser,
      directory: allUsers,
    });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// POST /api/auth/login — Authenticate user and establish session
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, email } = req.body;
    let user = null;

    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    const sameSite = isProd ? 'None' : 'Lax';
    const secureFlag = isProd ? ' Secure;' : '';

    res.setHeader(
      'Set-Cookie',
      `ff_user_id=${encodeURIComponent(user.id)}; Path=/; HttpOnly; SameSite=${sameSite};${secureFlag} Max-Age=2592000`
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/register & /api/auth/signup — Create a new user account
const handleRegister = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, department, role } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    // Role assignment: default to Employee.
    // Allow ProjectOwner only if explicitly requested, but NEVER allow client to assign CEO!
    let assignedRole: 'Employee' | 'ProjectOwner' = 'Employee';
    if (role === 'ProjectOwner') {
      assignedRole = 'ProjectOwner';
    }

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        role: assignedRole,
        department: department ? String(department).trim() : 'Operations',
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
      },
    });

    const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    const sameSite = isProd ? 'None' : 'Lax';
    const secureFlag = isProd ? ' Secure;' : '';

    // Establish session cookie immediately
    res.setHeader(
      'Set-Cookie',
      `ff_user_id=${encodeURIComponent(newUser.id)}; Path=/; HttpOnly; SameSite=${sameSite};${secureFlag} Max-Age=2592000`
    );

    res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        avatarUrl: newUser.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

router.post('/register', handleRegister);
router.post('/signup', handleRegister);

// POST /api/auth/logout — Destroy session and clear cookie
router.post('/logout', (req: AuthRequest, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  const sameSite = isProd ? 'None' : 'Lax';
  const secureFlag = isProd ? ' Secure;' : '';

  res.setHeader('Set-Cookie', `ff_user_id=; Path=/; HttpOnly; SameSite=${sameSite};${secureFlag} Max-Age=0`);
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;

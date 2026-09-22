import 'dotenv/config';
import express from 'express';
import http from 'http';

import { authenticate } from './server/auth.ts';
import { initSocket } from './server/socket.ts';

import authRouter from './server/routes/auth.ts';
import projectsRouter from './server/routes/projects.ts';
import phasesRouter from './server/routes/phases.ts';
import tasksRouter from './server/routes/tasks.ts';
import issuesRouter from './server/routes/issues.ts';
import risksRouter from './server/routes/risks.ts';
import milestonesRouter from './server/routes/milestones.ts';
import alertsRouter from './server/routes/alerts.ts';
import workloadRouter from './server/routes/workload.ts';
import notificationsRouter from './server/routes/notifications.ts';
import chatRouter from './server/routes/chat.ts';
import approvalsRouter from './server/routes/approvals.ts';
import baselinesRouter from './server/routes/baselines.ts';
import changelogRouter from './server/routes/changelog.ts';
import budgetRouter from './server/routes/budget.ts';
import portfolioRouter from './server/routes/portfolio.ts';
import documentsRouter from './server/routes/documents.ts';
import calendarRouter from './server/routes/calendar.ts';

const app = express();

const httpServer = http.createServer(app);

// Initialize Socket.IO
initSocket(httpServer);

// Middleware
app.use(express.json());

// Global Auth Middleware
app.use(authenticate);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Fern & Foley — Projects API',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Fern & Foley — Projects API',
    timestamp: new Date().toISOString(),
  });
});

// Authentication
app.use('/api/auth', authRouter);

// Domain Routers
app.use('/api/projects', projectsRouter);
app.use('/api', phasesRouter);
app.use('/api/tasks', tasksRouter);

app.post('/api/quality-checks/:id/toggle', (req, res, next) => {
  req.url = `/quality-checks/${req.params.id}/toggle`;
  tasksRouter(req, res, next);
});

app.use('/api/issues', issuesRouter);
app.use('/api/risks', risksRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/workload', workloadRouter);
app.use('/api/calendar', calendarRouter);

// Phase 2 Routers
app.use('/api/notifications', notificationsRouter);
app.use('/api', chatRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/projects', baselinesRouter);
app.use('/api/projects', changelogRouter);
app.use('/api/projects', budgetRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api', documentsRouter);

// Local development only
if (!process.env.VERCEL) {
  const PORT = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 5000;

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `\n  ➜ API Server running on: http://localhost:${PORT}\n`
    );
  });
}

// Export for Vercel
export default httpServer;
# Fern & Foley — Projects (Operations & Project Management)

Production internal project management and operations web application for Fern & Foley, structured as a clean full-stack application with decoupled frontend and backend modules.

---

## Project Structure

```
fern-&-foley-projects/
├── frontend/                     # React UI, components, views, context, CSS, client-side code
│   ├── package.json              # Frontend-only dependencies (React 19, Vite, Tailwind, Lucide, Motion)
│   ├── tsconfig.json             # Frontend TypeScript configuration
│   ├── vite.config.ts            # Frontend Vite build & dev proxy configuration
│   ├── index.html                # Single Page Application HTML entry
│   └── src/
│       ├── components/           # UI components (TopNav, Modals, Tabs, etc.)
│       ├── context/              # AuthContext & React context providers
│       ├── views/                # Views (Projects, Tasks, Portfolio, Approvals, Workload, etc.)
│       ├── lib/                  # Client utilities (socket.io client connector)
│       ├── types.ts              # Frontend TypeScript definitions
│       ├── App.tsx               # Root App layout & routing
│       ├── index.css             # Tailwind & design system styles
│       └── main.tsx              # React DOM entry point
│
├── backend/                      # API/server, routes, services, auth, Prisma, database logic
│   ├── package.json              # Backend dependencies (Express, Prisma, Socket.IO, Zod, Multer, AWS SDK)
│   ├── tsconfig.json             # Backend TypeScript configuration
│   ├── server.ts                 # Backend Express & Socket.IO server entry
│   ├── .env / .env.example       # Database connection strings & backend secrets
│   ├── prisma/
│   │   ├── schema.prisma         # Prisma schema (PostgreSQL / Neon)
│   │   └── seed.ts               # Database seed script
│   ├── lib/
│   │   ├── prisma.ts             # PrismaClient singleton instance
│   │   ├── calculations.ts       # Server-side business logic & metrics calculations
│   │   └── validators.ts         # Zod validation schemas
│   └── server/
│       ├── routes/               # Express API controllers (17 domain routers)
│       ├── services/             # Notification & S3 storage services
│       ├── auth.ts               # Authentication & RBAC middleware
│       └── socket.ts             # WebSocket server implementation
│
├── tests/                        # Vitest automated test suites (100 tests)
├── package.json                  # Root workspace orchestration scripts
├── tsconfig.json                 # Base TypeScript compiler options
└── README.md                     # Project documentation
```

---

## Getting Started

### 1. Install Dependencies

You can install dependencies for both frontend and backend independently or via root:

```bash
# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

### 2. Configure Database Environment
Ensure `backend/.env` has your database connection string:
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

### 3. Sync Database Schema & Seed Data
```bash
# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed
```

### 4. Run Development Servers
To run both backend and frontend:
```bash
# Terminal 1 (Backend API on http://localhost:5000)
npm run dev:backend

# Terminal 2 (Frontend Dev Server on http://localhost:3000)
npm run dev:frontend
```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev:backend` | Starts backend Express API and WebSocket server on port 5000 |
| `npm run dev:frontend` | Starts frontend Vite dev server on port 3000 (with proxy to port 5000) |
| `npm run build` | Builds both frontend and backend for production |
| `npm run build:frontend` | Builds production bundle for React frontend |
| `npm run build:backend` | Bundles backend server with esbuild |
| `npm start` | Starts production backend server |
| `npm test` | Runs Vitest automated test suite |
| `npm run db:push` | Pushes Prisma schema changes to database |
| `npm run db:seed` | Seeds database with initial projects, phases, tasks, and users |
| `npm run db:studio` | Launches Prisma Studio to view/edit database records |
| `npm run db:generate` | Generates Prisma Client types |

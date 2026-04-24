# Furra Franc - Bakery Management System

Full-stack bakery management app built with React, Node.js, shadcn/ui, Tailwind CSS, and PostgreSQL.

## Stack

- **Frontend**: React + Vite + TypeScript + shadcn/ui + Tailwind CSS + React Router v6
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL
- **Auth**: JWT + bcrypt

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up PostgreSQL
Create a database named `furra_franc` and update the connection string in `backend/.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/furra_franc"
```

### 3. Run database migrations
```bash
cd backend
npm run db:migrate
```

### 4. Seed the database (optional)
```bash
npm run db:seed
```
This creates:
- Admin: `admin@furrafranc.com` / `admin123`
- Staff: `staff@furrafranc.com` / `staff123`
- 5 sample products + 3 sample orders

### 5. Start the development servers
```bash
# From root - starts both frontend and backend
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | JWT authentication |
| Register | `/register` | New account creation |
| Dashboard | `/dashboard` | Stats overview + recent orders |
| Products | `/products` | Product catalog (CRUD for admins) |
| Orders | `/orders` | Order list + status management |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Current user |
| GET | `/api/products` | Yes | List products |
| POST | `/api/products` | Admin | Create product |
| PATCH | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |
| GET | `/api/orders` | Yes | List orders |
| POST | `/api/orders` | Yes | Create order |
| PATCH | `/api/orders/:id/status` | Admin | Advance status |
| GET | `/api/dashboard/stats` | Yes | Dashboard data |
# furra-franc

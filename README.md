# SMARTLIB — Smart Library Seat, Room & Occupancy Management System

SmartLib is a production-ready, university-grade web application engineered for managing library seats, study rooms, discussion suites, and physical campus occupancy.

Inspired by cinema-style interactive seating, students can remotely check live availability, select specific seats or rooms, and reserve them. Physical occupancy is confirmed strictly at the library front-desk via student registration number lookup.

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Socket.IO Client.
- **Backend:** Node.js v24, Express, TypeScript, Zod Schema Validation, Helmet, Morgan, Cookie-Parser, BCrypt.
- **Database:** MySQL 8.0 with InnoDB engine, row-level concurrency locking (`SELECT ... FOR UPDATE`), transaction rollback integrity, and foreign key cascades.
- **Real-Time Synchronization:** Socket.IO broadcasting seat reservations, check-ins, extensions, and releases to all connected clients.
- **Background Jobs:** Server-side reliable scheduler executing every 60 seconds with idempotency for no-show grace expiration (15 mins default) and auto-completion of elapsed sessions.

---

## 🔐 Credentials & Demo Accounts

All demo accounts use password: `smartlib123`

| Role | Email | Description / Registration No |
|---|---|---|
| **Admin** | `admin@smartlib.edu` | Chief Librarian (Full system control, rules, analytics, audit) |
| **Librarian** | `librarian@smartlib.edu` | Front Desk Staff (Lookup student registration, confirm check-in) |
| **Student 1** | `student1@smartlib.edu` | Aarav Patel (`REG-2026-001`) |
| **Student 2** | `student2@smartlib.edu` | Diya Sharma (`REG-2026-002`) |
| **Student 3** | `student3@smartlib.edu` | Vikram Rao (`REG-2026-003`) |
| **Student 4** | `student4@smartlib.edu` | Ananya Gupta (`REG-2026-004`) |
| **Student 5** | `student5@smartlib.edu` | Rohan Verma (`REG-2026-005`) |

---

## 🚀 Running Locally

### 1. Database Setup
Ensure MySQL 8.0 is running on port 3306. Create database `smartlib_db`.
Configure credentials in `backend/.env`.

Run migrations & seeds:
```bash
cd backend
npm run init:db
```

### 2. Start Backend Server
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

### 3. Start Frontend Client
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

---

## 🧪 Testing & Verification Suite

To run automated backend integration & concurrency tests:
```bash
cd backend
npx tsx testSuite.ts
```

All 17 verification checkpoints — including authentication, double-booking race condition rejection (`409 Conflict`), front-desk check-in, session extension, manual release, auto-expiry, and audit trail — have been verified.

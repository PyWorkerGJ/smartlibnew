# SmartLib — End-to-End Implementation Plan

## Overview
SmartLib is a modern, cinema-style seat and room occupancy management system for a university library. Students can view interactive seat maps, reserve resources (half-open intervals [start, end)), while physical check-in is conducted at the front desk by librarians/staff using student registration numbers. Sessions can be manually released, extended, automatically expired on no-show (15 min grace), or automatically closed when scheduled duration concludes.

## Architecture
- **Backend:** Node.js, Express, TypeScript, MySQL2 with connection pooling and transactions (FOR UPDATE locking), Socket.IO for real-time broadcasts.
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Lucide icons, Socket.IO Client.
- **Database:** MySQL 8.0 on localhost:3306 (database: `smartlib_db`).
- **Scheduling:** Server-side reliable scheduler checking no-shows (15 min grace) and auto-completing elapsed sessions every minute with transactional idempotency.

## Phase Breakdown
- [x] **Phase 1 — Inspect:** Workspace analyzed, runtime (Node 24, npm 11, MySQL 8.0) verified.
- [ ] **Phase 2 — Foundation & Database:** Backend scaffold, Knex/MySQL schema migrations, connection pooling, seed data (students, admins, librarians, 50+ seats across 2 floors & zones, 3 study rooms, 2 meeting rooms, default booking rules).
- [ ] **Phase 3 — Auth & Core Security:** Secure bcrypt hashing, sessions/JWT HTTP-only cookies, role-based authorization (STUDENT, LIBRARIAN, ADMIN), rate limiting, audit logger.
- [ ] **Phase 4 — Core Reservation Engine:** Time-slot interval validation [start, end), double-booking prevention using SELECT ... FOR UPDATE row-level locks, conflict detection, cancellation.
- [ ] **Phase 5 — Occupancy Lifecycle & Jobs:** Front-desk check-in by registration number, active session tracking, manual release, session extension with conflict validation, background scheduler for no-show auto-expiry and auto-completion.
- [ ] **Phase 6 — Student Frontend UI:** Interactive seat map with dynamic database grid layout, room booking, occupancy counters, current session view with real-time countdown, extension and release modals.
- [ ] **Phase 7 — Admin & Staff Portals:** Front-desk check-in interface, live resource status management (maintenance toggles), reservation audit, analytics dashboard (utilization, peak hours, no-show rates), configurable booking rules.
- [ ] **Phase 8 — Real-time & Consistency:** Socket.IO integration syncing seats, check-ins, and cancellations live across connected clients.
- [ ] **Phase 9 — Verification & Testing:** Automated unit & integration test suite (auth, concurrency conflict rejection, check-in, no-show expiration, extensions) + browser verification.
- [ ] **Phase 10 — Deployment & Distribution:** Production build, static frontend serving or production backend proxy, environment configuration, verification.

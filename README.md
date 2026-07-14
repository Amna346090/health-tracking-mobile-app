# Health & Medication Tracker

A monorepo containing a Node.js/Express backend and a React Native (Expo) mobile app.

```
health-tracking-mobile-app/
├── backend/          # Express + TypeScript REST API (Prisma + PostgreSQL)
├── mobile/           # React Native app (Expo + Expo Router)
├── docker-compose.yml
└── README.md
```

---

## Prerequisites

- Node.js 20+
- Yarn (workspaces)
- Docker & Docker Compose  **or** a local PostgreSQL 14+ instance
- Expo CLI (`npm install -g expo-cli`) or `npx expo`

---

## 1. Database

### Option A — Docker (recommended)

```bash
docker-compose up -d
```

Starts PostgreSQL on port **5433** (host) → **5432** (container).  
If port 5433 is taken, change the host port in `docker-compose.yml`.

Then set `DATABASE_URL` in `backend/.env`:
```
DATABASE_URL="postgresql://healthuser:healthpassword@localhost:5433/healthtracking?schema=public"
```

### Option B — Local Postgres

```bash
psql -U <superuser> postgres -c "CREATE USER healthuser WITH PASSWORD 'healthpassword' CREATEDB;"
psql -U <superuser> postgres -c "CREATE DATABASE healthtracking OWNER healthuser;"
```

Keep `DATABASE_URL` pointing to port 5432.

---

## 2. Backend

```bash
cd backend
cp .env.example .env   # edit DATABASE_URL / JWT secrets if needed
yarn install
yarn db:migrate        # runs Prisma migrations, generates client
yarn dev               # starts dev server on http://localhost:3000
```

---

## 3. Mobile

```bash
cd mobile
cp .env.example .env   # set EXPO_PUBLIC_API_URL if not on localhost
yarn install
yarn start             # opens Expo Dev Tools
```

Scan the QR code with **Expo Go**, or press `i` / `a` for iOS / Android simulator.

> **On a physical device:** set `EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000/api` in `mobile/.env`.

---

## Root scripts

```bash
yarn docker:up     # start Postgres via Docker
yarn docker:down   # stop Postgres
yarn backend       # run backend dev server
yarn mobile        # run Expo
```

---

## Environment variables

| Package | File | Key | Default |
|---------|------|-----|---------|
| backend | `backend/.env` | `PORT` | `3000` |
| backend | `backend/.env` | `DATABASE_URL` | `postgresql://healthuser:...@localhost:5432/healthtracking` |
| backend | `backend/.env` | `JWT_ACCESS_SECRET` | *(set a strong secret)* |
| backend | `backend/.env` | `JWT_REFRESH_SECRET` | *(set a different strong secret)* |
| backend | `backend/.env` | `JWT_ACCESS_EXPIRES_IN` | `15m` |
| backend | `backend/.env` | `JWT_REFRESH_EXPIRES_IN` | `7d` |
| mobile | `mobile/.env` | `EXPO_PUBLIC_API_URL` | `http://localhost:3000/api` |

---

## API Reference

All responses follow:
```json
{ "status": "ok" | "error", "data": {...} | "message": "..." }
```

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Server + DB status |

```bash
curl http://localhost:3000/api/health
```

---

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | Register a new user |
| POST | `/api/auth/login` | None | Login, get tokens |
| POST | `/api/auth/refresh` | None | Rotate refresh token |
| POST | `/api/auth/logout` | Bearer | Invalidate refresh token |
| GET | `/api/auth/me` | Bearer | Current user + profile |

#### Register (PATIENT)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "patient@example.com",
    "password": "Secret123!",
    "firstName": "Jane",
    "lastName": "Doe",
    "dateOfBirth": "1990-05-15",
    "phone": "555-1234"
  }'
```
> `dateOfBirth` is required when `role` is `PATIENT` (the default).

#### Register (STAFF)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "staff@clinic.com",
    "password": "Secret123!",
    "firstName": "Dr",
    "lastName": "Smith",
    "role": "STAFF"
  }'
```
> `role` can be `PATIENT` (default), `STAFF`, or `ADMIN`.

#### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "patient@example.com", "password": "Secret123!"}'
# → { data: { user, accessToken, refreshToken } }
```

#### Refresh tokens
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken": "<refresh_token>"}'
# → { data: { accessToken, refreshToken } }  (old refresh token is invalidated)
```

#### Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken": "<refresh_token>"}'
```

#### Me
```bash
curl http://localhost:3000/api/auth/me \
  -H 'Authorization: Bearer <access_token>'
```

---

### Patients

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/patients` | Bearer | STAFF, ADMIN | List all patient profiles |
| GET | `/api/patients/me` | Bearer | PATIENT | Own patient profile |
| GET | `/api/patients/:id` | Bearer | STAFF/ADMIN or own | Get profile by ID |
| PATCH | `/api/patients/:id` | Bearer | STAFF/ADMIN or own | Update profile |

> `:id` is the `PatientProfile.id` (returned in login / me responses).  
> A `PATIENT` can only read/update their own profile; `STAFF`/`ADMIN` can access any.

#### List all patients (staff/admin)
```bash
curl http://localhost:3000/api/patients \
  -H 'Authorization: Bearer <staff_access_token>'
```

#### Own profile (patient shortcut)
```bash
curl http://localhost:3000/api/patients/me \
  -H 'Authorization: Bearer <patient_access_token>'
```

#### Get patient by ID
```bash
curl http://localhost:3000/api/patients/1 \
  -H 'Authorization: Bearer <access_token>'
```

#### Update patient profile
```bash
curl -X PATCH http://localhost:3000/api/patients/1 \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "555-9999",
    "address": "123 Elm St",
    "dateOfBirth": "1990-05-15"
  }'
```
> All fields are optional. `firstName`/`lastName` update the `User` record; the rest update `PatientProfile`.

---

## Database schema (Phase 1)

```
User ──────────────── PatientProfile
  │                        │
  │                   MedicationAssignment ── Medication
  │                        │
  │                   MedicationLog (recorded by User)
  │                   HealthLog      (created by User)
  │                   Photo          (uploaded by User)
  │                   ReminderLog
  └── RefreshToken
```

Enums: `Role` (PATIENT/STAFF/ADMIN), `FeelingStatus` (GREAT/GOOD/OKAY/POOR/TERRIBLE),
`DoseStatus` (TAKEN/MISSED/SKIPPED), `ReminderChannel` (PUSH/EMAIL), `ReminderStatus` (PENDING/SENT/FAILED)

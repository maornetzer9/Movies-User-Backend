# cinema-ws — User & Authentication API

Authentication, JWT issuance, and user management for CinemaHub.

**Port:** `3000` (default)  
**Base path:** `/users`

---

## Purpose

Handles login, demo registration, password change, admin user CRUD, and session disconnect. Stores credentials in MongoDB and profile/permissions in JSON flat-files (`repositories/`). Issues JWTs signed with `SECRET_KEY` (must match `subscriptions-ws`).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGOOSE_URI` | Yes | MongoDB connection string |
| `SECRET_KEY` | Yes | JWT signing secret (shared with subscriptions-ws) |
| `ORIGIN` | Yes | CORS allowed origin (e.g. `http://localhost:5173`) |
| `SMTP_HOST` | For admin email | SMTP server for welcome emails |
| `SMTP_PORT` | For admin email | Usually `587` |
| `SMTP_USER` | For admin email | SMTP username |
| `SMTP_PASS` | For admin email | SMTP password |
| `SMTP_SECURE` | No | `true` for port 465 |
| `MAIL_FROM` | No | Visible From address |

Copy `.env.example` to `.env` before running:

```bash
cp .env.example .env
```

`.env` is gitignored — `MONGOOSE_URI`, `SECRET_KEY`, and the SMTP credentials must never be committed. Add any new variable to `.env.example` with a placeholder value and to the table above.

---

## Main Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/users/login` | No | Login; returns JWT |
| `POST` | `/users/register` | No | Demo self-registration (rate limited) |
| `PUT` | `/users/change-password` | JWT | First-login / forced password change |
| `GET` | `/users/` | JWT + Admin | List all users |
| `POST` | `/users/add` | JWT + Admin | Create user + onboarding email |
| `PUT` | `/users/edit` | JWT + Admin | Edit user profile and permissions |
| `DELETE` | `/users/delete` | JWT + Admin | Delete user |
| `PUT` | `/users/disconnect` | JWT | Update session timeout on logout |

All protected routes require `Authorization: Bearer <token>` and enforce `mustChangePassword` except login, register, and change-password.

---

## How to Run

```bash
npm install
npm run dev    # nodemon — auto-reload
npm start      # production
```

Server listens after MongoDB connects. See [root README](../README.md#running-the-project).

---

## Dependencies

| Package | Use |
|---|---|
| `express` | HTTP server |
| `mongoose` | MongoDB (User credentials) |
| `jsonwebtoken` | JWT sign/verify |
| `bcryptjs` | Password hashing |
| `helmet` | Security headers |
| `cors` | Cross-origin requests |
| `express-rate-limit` | Auth endpoint rate limiting |
| `nodemailer` | Admin onboarding emails |
| `dotenv` | Environment configuration |

---

## Documentation

- [README.md](../README.md) — full project setup
- [docs/PROJECT_SPECIFICATION.md](../docs/PROJECT_SPECIFICATION.md) — technical spec
- [CLAUDE.md](../CLAUDE.md) — developer guide

# WayCare: 3D indoor hospital navigation (v3)

Node/Express + SQLite backend, Three.js frontend. Fictional 3-floor hospital.

## Run
    npm install
    npm start        # http://localhost:3000   (admin: http://localhost:3000/admin)

Admin credentials must be configured securely using environment variables before deployment.
Env vars: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_PATH`, `RETAIN_DAYS` (default 30), `PORT`.

## Access model
- **Patients and visitors: no sign-in.** The map opens instantly (important in an emergency). Each device gets a random anonymous code (cookie), so the admin can see "Visitor 3fa9c1 searched Cardiology" without any name, email or patient data.
- **Admins only: sign-in.** `/admin` shows a login page to anyone else. Admin APIs return 401/403 without an admin session.
- Search history is deleted automatically after 30 days.

## API
| Method | Path | Access |
|---|---|---|
| GET | /api/route?from=&to=&stepFree= | public (logged anonymously) |
| GET | /api/closures, /api/appointments/:id, /api/me/history | public (history = this device only) |
| POST | /api/auth/login, /api/auth/logout | admins |
| GET | /api/admin/stats, /searches?visitor=, /visitors | admin |
| POST/DELETE | /api/admin/closures | admin |

## Deploy
Render: push to GitHub, New > Blueprint (`render.yaml`). Free disks reset on restart; add a disk or Postgres for persistence.
Docker: `docker build -t waycare . && docker run -p 3000:3000 -e JWT_SECRET=x -e ADMIN_PASSWORD=y waycare`

## Security notes
Admin passwords hashed (bcrypt); admin session is an httpOnly SameSite JWT cookie, role re-checked in the database on each request; login rate-limited; admin pages are not served statically. Public routes expose only route calculation and closures.

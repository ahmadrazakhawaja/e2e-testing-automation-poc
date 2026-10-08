# E2E Testing Automation POC

A small Nuxt 4 (Vue 3 + Nitro) app with a Prisma/SQLite backend: a login flow, a dashboard,
and a tasks page (create / complete / delete). The login flow is covered by a Playwright
end-to-end suite that runs entirely from the CLI; tests for the tasks page are meant to be
generated in CI.

## Pages and API

| Route        | What it does                                              |
| ------------ | --------------------------------------------------------- |
| `/login`     | Sign-in form                                              |
| `/dashboard` | Account info + task summary (auth required)               |
| `/tasks`     | Add tasks, tick them off, delete them (auth required)     |

| Endpoint                  | Notes                                                    |
| ------------------------- | -------------------------------------------------------- |
| `POST /api/auth/login`    | `{ email, password }` → sets the `session` cookie        |
| `POST /api/auth/logout`   | Destroys the session                                     |
| `GET /api/auth/me`        | `{ user }` or `{ user: null }`                           |
| `GET /api/tasks`          | Current user's tasks                                     |
| `POST /api/tasks`         | `{ title }` (1–120 chars) → `201` with the task          |
| `PATCH /api/tasks/:id`    | `{ done?, title? }` → `404` if not yours                 |
| `DELETE /api/tasks/:id`   | `204`, or `404` if not yours                             |

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| UI       | Nuxt 4 / Vue 3 (`app/`)                                     |
| Backend  | Nitro server routes (`server/api/`)                         |
| Database | Prisma 6 + SQLite (`prisma/schema.prisma`)                  |
| Auth     | bcrypt password hashes, DB-backed sessions, HttpOnly cookie |
| E2E      | Playwright (`tests/e2e/`)                                   |

## Getting started

```bash
cp .env.example .env
npm install
npm run db:setup              # create the SQLite DB and seed the demo user
npm run dev                   # http://localhost:3000
```

Demo login: `demo@example.com` / `Password123!` (defined in `prisma/seed-data.ts`).

## Running the e2e tests

```bash
npx playwright install chromium   # once
npm run test:e2e                  # headless, from the CLI
```

`npm run test:e2e` is fully self-contained. Playwright's `webServer`:

1. syncs the schema and re-seeds a **separate** test DB (`prisma/e2e.db`), so your dev data is untouched,
2. builds the app (`nuxt build`),
3. starts the production server on port `3100`, runs the suite, and shuts it down.

Other modes:

```bash
npm run test:e2e:headed     # watch the browser
npm run test:e2e:ui         # Playwright UI mode (time-travel debugging)
npm run test:e2e:report     # open the last HTML report
npx playwright test -g "wrong password"   # run a single test by name
```

To run against an already-deployed environment instead of a local build:

```bash
E2E_BASE_URL=https://staging.example.com npm run test:e2e
```

Failures keep a trace, screenshot and video under `test-results/`. Open a trace with
`npx playwright show-trace <path>/trace.zip`.

## What's tested

- **Login UI** (`tests/e2e/login.spec.ts`): successful login lands on the dashboard with the user's tasks,
  wrong password / unknown email show the same generic error, client-side validation,
  error recovery, case-insensitive email.
- **Route protection**: anonymous users get bounced to `/login?redirect=…` and are sent back after login,
  off-site redirect targets (`//evil.example.com`) are ignored, and signed-in users skip the login page.
- **Session**: survives reload, and logout invalidates it.
- **Auth API** (`tests/e2e/auth-api.spec.ts`): 400/401 responses, HttpOnly session cookie,
  no password hash in responses, protected `/api/tasks`.

Not yet covered: the `/tasks` page and the task endpoints (to be generated in CI). Note that the
existing dashboard test asserts the seeded task count for `demo@example.com`, so generated tests
that create or change tasks should use their own user or clean up after themselves — the suite
runs in parallel against one database.

Tests use a Page Object Model (`tests/e2e/pages/`) and an `authenticated` fixture
(`tests/e2e/fixtures.ts`) that logs in via the API so non-login tests stay fast.

## E2E agent

`tools/e2e-agent` is an AI agent that writes Playwright tests for whatever a PR changed and opens them
as a separate PR into that PR's branch. Add the `e2e-agent` label to a PR to run it. See
[tools/e2e-agent/README.md](tools/e2e-agent/README.md).

Tests that change data use the `signedInUser` fixture: a fresh user per test, deleted afterwards
(`tests/e2e/support/test-users.ts`). Conventions for humans and the agent: `tests/e2e/CONVENTIONS.md`.

## CI

`.github/workflows/e2e.yml` runs the same `npm run test:e2e` on every push/PR and uploads the HTML report as an artifact.

## Project layout

```
app/                 Vue pages, layout, auth middleware, composables
server/api/          auth and task endpoints
server/utils/        Prisma client, session and task helpers
prisma/              schema, seed script, shared seed data
tests/e2e/           Playwright specs, fixtures, page objects
playwright.config.ts
```

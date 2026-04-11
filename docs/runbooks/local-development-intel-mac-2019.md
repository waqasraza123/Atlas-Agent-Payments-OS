# Local Development on a 2019 Intel MacBook Pro

## Assumptions

- The target machine is a 2019 Intel MacBook Pro.
- Docker Desktop is installed and used only for PostgreSQL, Redis, MinIO, and MailHog.
- Node `24.x` is installed through `nvm`.
- `pnpm 10.x` is used across the repo.
- Application processes run directly on macOS for lower memory overhead and faster restart times.
- The repo stack is optimized for one frontend, one API, one worker, and infra containers only.

## Setup

1. `nvm install 24`
2. `nvm use 24`
3. `cp .env.example .env`
4. `pnpm install`
5. `pnpm infra:up`
6. `pnpm db:generate`
7. `pnpm db:migrate`
8. `pnpm db:seed`

## Daily commands

- `pnpm dev` runs web, API, and worker together.
- `pnpm dev:web` runs only the Next.js app.
- `pnpm dev:api` runs only the NestJS API.
- `pnpm dev:worker` runs only the BullMQ worker.
- `pnpm infra:down` stops local infra.

## Memory and performance guardrails

- Keep Docker limited to infrastructure services only.
- Run only the app processes you need while working on a focused area.
- Avoid opening unnecessary Dockerized app containers on this machine.
- Prefer `pnpm --filter ...` commands over starting the full workspace when possible.
- Keep Docker Desktop on a conservative resource profile. Favor fewer running containers over bigger defaults.
- Do not add local Kubernetes, local cloud emulators, or extra databases during Phases 0 through 6.

## Chosen local stack

- Web: Next.js App Router with React `19.2`
- API: NestJS `11.x`
- Worker: Node TypeScript plus BullMQ `5.x`
- Database ORM: Prisma `6.19.x`
- PostgreSQL: `16-alpine`
- Redis: `7-alpine`
- Object storage: MinIO
- SMTP capture: MailHog

These versions are intentional. They match the current scaffold and avoid unnecessary upgrade churn while the product is still being shaped.

## Local service endpoints

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- MailHog UI: `http://localhost:8025`

## Troubleshooting

- If `pnpm install` runs under the wrong Node version, switch to Node 24 and reinstall.
- If Prisma commands fail, confirm PostgreSQL is healthy and the `DATABASE_URL` matches `.env`.
- If Prisma connects but migration or seed still fails, check whether another local PostgreSQL instance is occupying port `5432` with different credentials.
- If the worker fails to boot, confirm Redis is running.
- If MinIO does not start, ensure ports `9000` and `9001` are free.
- If `3000` is already in use, verify which local process owns it before assuming the web scaffold is broken.

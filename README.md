# Cluster Map

## Description

Project aims to create a web application that provides real-time information about free/taken places for each cluster. It shows places and people with meaningful color indications in a clear, intuitive way.

Feature list:

- Cluster map with free/taken places
- Hover over place to see more details about peer (Name, time, etc)

## Team

Full-Stack Architect/ Team Lead - Artem Kuchmambetov

Front-end - Maxim Kleverov

Back-end - Vitalii Lundaev

Back-end / Database - Valentine Moroka

DevSecOps - Ping Yu

## Tech Stack

Front-end:

- React & Vite
- Tailwind
- Untitled UI (modified to fit HIVE Brand) based on React Aria
- Vitest / Playwright / MSW (tests)

Back-end:

- TS & Node.js & Express (Restful Api)
- PostgreSQL
- Drizzle ORM
- Zod Validation
- Vitest / Supertest

Tools:

- Trello (task management system)
- GitHub / GitHub CI/CD (self-hosted runner)
- Docker Compose
- Docusaurus (Static site generator for project documentation)
- Hetzner dedicated / VPS
- Cloudflare (temporary domain/dns for map-hive.pp.ua)
- Pnpm (mono-repo)

### API authentication

Registration requires administrator approval, not email verification. No SMTP service
or email settings are needed. Set `BETTER_AUTH_SECRET` (at least 32 random characters;
generate with `openssl rand -base64 32`) and `BETTER_AUTH_URL` (public API origin) in
`.env`. `WEB_ORIGIN` must match the web/admin application's origin. Use HTTPS in production.

| Method | Path                    | Input                                                                                     | Success                                                                     |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/api/auth/register`    | JSON `{ "name": "Person", "email": "person@example.com", "password": "a-long-password" }` | 200, generic acknowledgment that registration awaits administrator approval |
| POST   | `/api/auth/confirm/:id` | Private approval token in `:id`, authenticated administrator session cookie               | 200, `{ "message": "Account approved. The user can now log in." }`          |
| POST   | `/api/auth/login`       | JSON `{ "email": "person@example.com", "password": "a-long-password" }`                   | 200, safe user profile and session cookies                                  |

Registration generates a random 256-bit `user.approval_token` in the same insert as
the account. It is never returned to the registrant. The token remains valid until
approval and is removed atomically when used. Approval is separate from Better Auth's
`emailVerified` field, which remains false: approval does not claim email ownership.
Pending users receive 403 on login and no session is created. Public registration
cannot set `role`, `approved`, or the token.

The confirmation route is now **POST**, not GET. It requires a valid session and checks
that the caller currently has `role = 'admin'` and `approved = true` in the database.
Unauthenticated callers receive 401; ordinary, demoted, or unapproved users receive 403.
Invalid or consumed approval tokens return 404. Approval does not sign in the target
user or replace the administrator's session. Browser requests must use
`credentials: "include"`; untrusted browser origins are rejected.

#### Database migration and first administrator

Run `pnpm db:migrate` before starting the updated API. Migration `0002_admin_approval`
adds `role`, `approved`, and `approval_token`. **Existing users become pending** and
receive approval tokens too. No account is automatically made administrator.

To bootstrap the first administrator, register the intended account, verify its
identity through your trusted operational process, then run this SQL using a trusted
database connection, replacing the example ID with that account's actual user ID:

```sql
UPDATE "user"
SET role = 'admin', approved = true, approval_token = NULL, updated_at = now()
WHERE id = '<trusted-user-id>';
```

That user can then log in normally and approve other accounts. Subsequent role changes
must also be made through trusted administration; this API exposes no public role editor.

#### Admin panel integration

The future admin panel backend can read pending accounts with a privileged database
query. Keep these tokens restricted to authenticated administrators:

```sql
SELECT id, name, email, created_at, approval_token
FROM "user"
WHERE approved = false
ORDER BY created_at;
```

When an administrator chooses Approve, send `POST /api/auth/confirm/<approval_token>`
with their session cookie. There is no public pending-user list and no admin panel UI
in this change; the API still exposes exactly three auth routes.

The auth router permits 10 requests per minute per IP (429 after that), with a
process-local limiter. Multi-instance deployments need a shared limiter store. Keep
Express proxy trust restricted to known proxies. Approval tokens are redacted from
API request logs; configure equivalent redaction in reverse-proxy/access logs.

Unit tests: `pnpm --filter @repo/api test`. Integration tests:
`pnpm --filter @repo/api test:integration`. To run real Better Auth approval tests,
set `AUTH_DB_TEST=1` and `PG_*` to a **disposable, migrated PostgreSQL database**. Tests
create random accounts and verify pending login, admin-only access, current role checks,
concurrent approval/token consumption, session cookies, and privilege-injection rejection.

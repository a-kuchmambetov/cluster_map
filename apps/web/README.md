# Cluster Map web app

React + Vite client for cluster layouts and live occupancy. Run commands from the repository root with pnpm.

## Development and checks

```sh
pnpm install --frozen-lockfile
pnpm --filter @repo/web dev
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web lint
pnpm --filter @repo/web test
pnpm --filter @repo/web build
```

Use `pnpm --filter @repo/web test:watch` for watch mode and `pnpm --filter @repo/web start` to preview a production build. The root `pnpm typecheck` includes this app. Unit and React hook tests use Vitest with Happy DOM; they are colocated with feature code and cover map transforms, request ownership, and SSE recovery.

The API must also be running for live data. See the [root README](../../README.md) for database and API setup.

## Configuration

Vite reads environment files from the repository root (`envDir` in `vite.config.ts`). Copy the root `.env.example` to `.env` when setting up the repository; never commit credentials.

- `API_PORT` controls the development `/api` proxy target, defaulting to `5000`.
- `VITE_API_URL` optionally sets the API origin. The client appends `/api`; leave it empty to use the same origin.
- Only `VITE_` variables are exposed to client code. They are public, build-time values.
- Production hosting must route `/api` to the API or provide `VITE_API_URL` at build time; Vite's development proxy is not a production proxy. SPA hosting also needs an `index.html` fallback for client routes.

## Structure and ownership

```text
src/
  main.tsx                 DOM mounting and global CSS
  app/                     Route composition and application providers
  pages/                   Thin route entry points
  features/cluster-map/
    index.ts               Public feature entry point
    cluster-map-screen.tsx Feature screen composition
    api/                   HTTP calls and SSE subscription lifecycle
    components/            Map, rows, places, selector, and loading skeleton
    hooks/                 Data orchestration, request ownership, and UI behavior
    model/                 Frontend view types, transforms, and occupancy deltas
    lib/                   Geometry and place styling helpers
  components/              Reusable Untitled UI component library
  hooks/                   Generic browser/UI hooks
  utils/                   Generic utilities and UI datasets
  config/                  Shared client API configuration
  styles/                  Global styles and light/dark design tokens
  types/                   Ambient Vite declarations
```

Pages consume features through `index.ts`. Feature internals use direct relative imports; `@/` is available for shared imports. Shared code must not import features, pages, or app composition, and features must not import pages or app composition. The root Oxlint configuration enforces these boundaries. Add public exports deliberately instead of re-exporting every internal file.

API transport contracts remain in `@repo/types`. Frontend-only view types stay in the feature. Layout and occupancy snapshots have independent requests; superseded requests are cancelled and cannot commit old data. Switching clusters hides previous data before effects start the replacement requests. Same-cluster refresh failures retain the last snapshot and mark it stale.

The event stream opens after an occupancy snapshot loads. DB failures retain the stream and retry the snapshot every 30 seconds. Transport failures close the stream and require a successful fresh snapshot before reconnecting. Cleanup cancels timers and prevents reconnection after unmount or selection changes.

## UI library audit

The reusable Untitled UI catalog is intentionally retained as the local design system, including its marketing components, icons, assets, and supporting dependencies. Most are not currently imported by the map page; that alone does not make them obsolete. Keep new product-specific UI inside its feature. Extract a shared component when it has a reusable responsibility.

The unused `globals` development dependency and Vite placeholder SVGs were removed, and the document metadata now identifies Cluster Map. Existing CSS tokens remain centralized so both themes keep their current behavior.

## Browser smoke checks

After structural or rendering changes, verify initial loading and failure/retry states, rapid cluster switching, occupancy updates, DB/stream recovery, place selection and Escape/outside-click dismissal, narrow-screen scaling and scrolling, and both light and dark themes. Happy DOM tests do not verify browser geometry or visual appearance.

## License

Untitled UI React open-source components are licensed under the MIT license, which means you can use them for free in unlimited commercial projects.

> [!NOTE]
> This license applies only to the starter kit and to the components included in this open-source repository. [Untitled UI React PRO](https://www.untitledui.com/react) includes hundreds more advanced UI components and page examples and is subject to a separate [license agreement](https://www.untitledui.com/license).

[Untitled UI license agreement →](https://www.untitledui.com/license)

[Frequently asked questions →](https://www.untitledui.com/faqs)

## Authentication

`/login` and `/register` are public. `/` requires a valid Better Auth session and
administrator approval. Registration displays a pending-approval result; it does
not sign the user in. Approval uses the existing administrator API; no approval
or password-reset UI is included.

The auth provider checks `/api/auth/session` before mounting the map. Network
failures show retry UI; `401` redirects to login and `403` hides private content.
Logout clears the server session before removing local auth state. Tokens are not
stored in local/session storage. HTTP and SSE include cookie credentials.

Prefer a same-origin `/api` reverse proxy in production. Set `WEB_ORIGIN` to the
actual web origin and `BETTER_AUTH_URL` to the externally reachable auth API
origin. Use HTTPS in production. If `VITE_API_URL` points to another origin,
verify credentialed CORS and cookie SameSite/domain behavior in the deployed
browser; arbitrary cross-site cookie deployments are not configured by the web app.

Smoke checks: register and verify the pending result; approve the account via the
existing administrator flow; sign in; reload `/`; sign out; attempt direct API
access without a cookie; revoke approval during an open map and verify access
ends after the next request or stream check (20 seconds plus check latency).

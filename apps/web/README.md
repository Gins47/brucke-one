# Brücke One web dashboard

The frontend lives in `apps/web`. It is a Next.js dashboard for the local
development administrator.

Use Node.js 24.7.0 or later. From this directory, select the pinned local
version and install dependencies:

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

Open the address printed by Next.js. When the API already uses port 3000, Next
will normally use `http://localhost:3001`. `NEXT_PUBLIC_API_BASE_URL` is
the public browser API URL and defaults to `http://localhost:3000`; it is not a
secret.

Start the API from `apps/api` in a separate terminal. Its local `.env` must use
`NODE_ENV=development` and `WEB_ORIGIN=http://localhost:3001`. The API enables
CORS only in development for that exact origin, with credentials and the
`Content-Type`, `Authorization`, and `X-Brucke-Request` headers.

The dashboard uses an HttpOnly JWT cookie and restores the administrator on
refresh. Only the selected organization ID is stored in sessionStorage; after
refresh it is validated against the current organization list. If storage is
unavailable, selection stays in memory. Logout clears the cookie and local
selection, but does not revoke a copied token. The current ADMIN role has
application-wide access and organization selection is a UI filter, not an
authorization boundary.

For a local synthetic-data check, start the API and dashboard as described
above, log in with the configured development administrator, select an
organization and open a protected page. Refresh and confirm that the page and
validated selection remain available. Log out and confirm protected access is
no longer available in that browser; also verify an expired or invalid session
returns to login. The user reported successful local browser testing; the
individual steps were not separately enumerated in that report.

Run verification with:

```bash
npm run test
npm run lint
npm run build
```

## Available pages

- `/login` — development administrator login.
- `/organizations` — choose and locally search the loaded organization list.
- `/` — the selected organization dashboard, including overview counts and
  active operations.
- `/shelters` — selected-organization shelter readiness, including
  reported-only totals, availability coverage, follow-up items, a responsive
  list, and a map where coordinates are available.
- `/shelters/[shelterId]` — stable shelter facts, its active operation context,
  and the complete availability report/update form when the parent operation
  remains active.
- `/operations` — selected-organization operations with status filters and
  cursor-based Load more pagination.
- `/operations/[operationId]` — operation details,
  active shelter locations, the unmapped active-shelter count, and a Help
  requests tab with pending and reserved queues and manual shelter assignment.

The operation map uses OpenStreetMap standard tiles with visible attribution
and requires network access to the tile service. A failed Leaflet load shows a
map-unavailable message. The map also switches to that message after repeated
tile failures, rather than reacting to one transient tile error. Shelter
details remain available in the Shelters tab. See the [OpenStreetMap tile
usage policy](https://operations.osmfoundation.org/policies/tiles/) before
using this local setup at larger scale.

The shelter readiness map displays only real selected-organization shelter
data. It labels accepting, not-accepting, not-reported, and inactive shelters
separately; the shelter list remains usable when that map is unavailable.

## Current limitations

This is a development demonstration. Authentication uses the local,
application-wide ADMIN role; it is not organization-level isolation. Logout
does not revoke an already issued token. The tab-local organization selection
is not guaranteed across tabs or browser restarts. A late `401` from an old
operations pagination request can clear the current session after an
organization switch; fixing it is required before presenting switching as
reliable.

The UI supports availability reporting and manual shelter assignment for
synthetic data. It does not implement server-side sessions, refresh tokens,
region boundaries, historical map reconstruction, map clustering, or viewport
search. Weather, operations teams, support units, and approvals remain
unavailable.

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
CORS only in development for that exact origin and allows the `Content-Type`
and `Authorization` headers.

Login state and the selected organization exist only in browser memory. A
refresh requires login again. Logout clears that local state; it does not
revoke the issued API token. The current ADMIN role has application-wide access
and organization selection is a UI filter, not an authorization boundary.

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
- `/operations/[operationId]` — operation details, current affected regions,
  active shelter locations, and the unmapped active-shelter count.

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
application-wide ADMIN role; it is not organization-level isolation. Tokens
and selected organizations are held only in memory, and logout does not revoke
an already issued token.

Apart from complete availability reports for active shelter activations, the
UI does not implement write actions, persistent sessions, refresh tokens,
region boundaries, historical map reconstruction, map clustering, or viewport
search. Weather, occupancy, operations teams, people seeking help, support
units, and approvals are intentionally shown as unavailable until their API
data and workflows exist.

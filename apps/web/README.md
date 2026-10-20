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
npm run lint
npm run build
```

The current checkpoint supports login, organization selection, switching, and
client-side logout. Dashboard data, shelter lists, operation lists, maps, and
create/edit controls remain for later checkpoints.

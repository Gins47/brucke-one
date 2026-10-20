# Brücke One web dashboard

The frontend lives in `apps/web`. It is a Next.js dashboard shell that will
connect to the Nest API in later Iteration 006 checkpoints.

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
prepared for later browser API requests and defaults to `http://localhost:3000`;
it is public configuration, not a secret.

Run verification with:

```bash
npm run lint
npm run build
```

The foundation intentionally has no login flow, API calls, live dashboard
data, organization switching, map, or create/edit controls yet.

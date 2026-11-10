# ADR 0006 — Next.js dashboard, in-memory sessions, and Leaflet maps

**Status:** Accepted for the development proof of concept; recorded retrospectively on 2026-11-10.

## Context and decision

Use Next.js, React, TypeScript, Tailwind, and a small local component set for the operator dashboard. Call the API through a typed client. Keep the access token and selected organization in browser memory; clear them on logout or session expiration. Use Leaflet/React Leaflet with attributed OpenStreetMap tiles and provide an unavailable state when map loading fails.

Use a narrowly configured development CORS origin. Later shelter views use the organization dashboard read model instead of filtering the global shelter list in the browser.

## Consequences

Refreshing the browser requires login again; client logout does not revoke a token. The selected organization is a UI context, not an authorization boundary. Maps depend on a tile provider and can fail independently of shelter lists. Desktop/mobile browser and live-tile verification remain unrecorded; see [Iteration 006](../iterations/006-operations-dashboard-ui.md).

## Evidence

- [Iteration 006 technology and acceptance](../iterations/006-operations-dashboard-ui.md) and [Iteration 007 shelter UI](../iterations/007-shelter-availability-and-readiness.md)
- [Session provider](../../apps/web/src/components/session-provider.tsx), [map components](../../apps/web/src/components/maps/), and [API CORS configuration](../../apps/api/src/cors.config.ts)

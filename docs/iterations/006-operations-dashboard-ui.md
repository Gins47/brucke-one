# Iteration 006 — Operations Dashboard UI

**Status:** In progress  
**Prerequisites:** Iterations 001–005 completed; the Nest API and development admin login work locally.

## Goal

Build a clear, read-only web dashboard for a development administrator to select and switch organizations, inspect current and past emergency operations, and view active shelters on an operation map. Use the approved white-and-blue mock screens as visual direction.

The application is a trusted local-development demonstration. The current API grants an admin application-wide access. Selecting an organization is a UI filter, not an authorization boundary.

## Technology and architecture

- Next.js, React and TypeScript; use the existing frontend and repository conventions if present. Inspect the repository before creating or replacing any project structure. Use a Node version compatible with the existing repository and chosen dependencies.
- Tailwind CSS and shadcn/ui for a small set of accessible, reusable components. Install only what is needed.
- Leaflet with React Leaflet for rendering the shelter map. Load browser-dependent map code on the client; use a suitable map tile provider with attribution and document its usage terms and configuration. If no approved tile source can be used, show a clear map-unavailable state rather than inventing one.
- Turf.js is reserved for a future feature that needs geospatial calculations; do not install it simply to render markers.
- A small typed API client calls the existing Nest endpoints. Use the actual checked-in response DTOs, routes and contracts as the source of truth. Keep auth state, selected organization, API calls, pages and reusable components clearly separated. Avoid a generic framework, state-management dependency, or speculative abstraction.
- Configure the local API base URL through an environment variable. This is a public browser configuration value, not a secret. Handle CORS through the smallest explicit local-development configuration if necessary; inspect the API configuration first and document any change.
- Errors from the API must not expose tokens or credentials. Provide loading, empty and error states; do not present mock data as live data.

## Visual direction

Follow the approved mockups: white and light-neutral backgrounds, a dark navy sidebar, blue accents and primary actions, understated borders, readable typography and generous spacing. Provide status labels in text as well as color. Make the sidebar and content usable on narrow screens and support keyboard navigation, visible focus and accessible labels.

The mockups are visual direction, not a specification for extra functionality. Notifications, new-operation actions, update feeds and other illustrated controls are outside scope. Do not render nonfunctional buttons or imply they work.

## Authentication and organization selection

- Login uses the existing admin login endpoint. Keep the JWT and selected organization in memory; do not store either in localStorage or sessionStorage. Browser refresh clears the session and selection, requiring login and organization selection again.
- Unauthenticated users are directed to login. On successful login, show organization selection. Logout clears in-memory credentials and selected organization. Logout in this iteration is client-side only; it does not revoke an issued JWT.
- Use the existing organization list API to display available organizations. Show a clear empty state when none exist and an error/retry state if loading fails.
- Show the selected organization in a sidebar switcher. Permit switching at any time. Every organization-specific screen must use the selected ID and reset filters/cursors/data when the selection changes. Prevent late responses for the previous organization from appearing after a switch.
- For V1, the switcher may filter the already-loaded small organization list locally. Do not describe this as server-side search or scalable pagination. Backend organization search/pagination is deferred.
- A 401 clears in-memory authentication and returns the user to login; show an appropriate message. Handle 403, network failures and server errors clearly without exposing sensitive information.

## Pages and data

The sidebar offers Dashboard, Organizations, Shelters and Emergency operations. Login has no sidebar. Operation detail is reached from the operations list.

1. **Login** — username/password form with validation, loading and generic authentication errors. Never prefill or log credentials.
2. **Dashboard** — selected organization name and counts from its dashboard overview: operations by status, total shelters and active shelter activations. Empty values are displayed accurately, including zero. Links may navigate to pages in scope.
3. **Organizations** — list and select existing organizations; show the selected organization's overview using existing APIs. Switching here and in the sidebar has the same effect.
4. **Shelters** — show shelters belonging to the selected organization with available name, address, capacity and contact details. Use the existing shelter list contract. If the API returns an unpaginated global list, filter by organization on the client for this small development dataset and document the scaling limitation. Never claim client-side filtering is authorization; server-side scoping/pagination are deferred.
5. **Emergency operations** — selected organization's operations from the existing dashboard list. Offer All, Planned, Active, Completed and Cancelled as individual status filters. Preserve backend `updatedAt DESC, id DESC` ordering. Use the returned opaque cursor for Load more, and reset it when changing organization or filter. No combined past filter requiring client-side filtering of paginated results. Completed and Cancelled are individually accessible.
6. **Operation detail and map** — use the existing operation map projection. Show the operation summary, current affected region codes/names, active mapped shelters as markers and the count of active shelters without coordinates. Show clear empty/unavailable map states. The API does not provide region boundaries or a historical snapshot: do not imply that current map data reconstructs a past operation. Ensure an operation opened through an old URL from another selected organization is not displayed as belonging to the current selection; verify its organization ID and offer navigation back to the list.

## Checkpoints

Implement, test, review and commit one checkpoint at a time. Consult existing API DTOs and test conventions before each change.

### 1. Frontend foundation and layout

- Inspect existing workspace/frontend setup; reuse it where appropriate.
- Establish Next.js/TypeScript, Tailwind and minimal shadcn/ui setup, API base URL configuration and the shared white-and-blue layout/sidebar.
- Define the intended page routes and responsive navigation; avoid nonfunctional feature controls and do not build later pages yet.
- Document how to run the frontend locally. Add only focused tests justified by the new behavior.

**Status:** Complete

**Implementation record:**

- No frontend existed, so the standalone Next.js application was created at `apps/web`, alongside the Nest API. It uses Next.js, React, TypeScript, Tailwind CSS, and the minimal local shadcn/ui-compatible `Badge` component and configuration.
- The shared responsive shell provides a dark navy sidebar, light content area, blue accents, visible keyboard focus, and text-only navigation labels for Dashboard, Organizations, Shelters, and Emergency operations. Those labels are deliberately not links until their pages are implemented in later checkpoints.
- Copy `apps/web/.env.example` to `apps/web/.env.local`, run `nvm use`, `npm install`, and `npm run dev` from `apps/web`. `NEXT_PUBLIC_API_BASE_URL` is prepared as public browser configuration only; this checkpoint does not call the API.
- Node.js 24.22.0 was used. The app requires Node.js 24.7.0 or later. `npm run build` uses Next's supported webpack mode because Turbopack cannot create its local helper process in the current environment.

**Planned frontend paths:**

- `/login` — administrator login
- `/` — selected-organization dashboard
- `/organizations` — organization selection and overview
- `/shelters` — selected organization shelters
- `/operations` — selected organization emergency operations
- `/operations/[operationId]` — operation detail and shelter map

These paths are documentation only for now. Their routes and links are introduced in later checkpoints.

### 2. Login and organization selection

- Implement the login form, in-memory auth state, protected UI navigation, organization selection, sidebar switcher, local client-side search for the small loaded list and client-side logout.
- Handle auth expiration/401 and prevent stale organization-specific data when switching.
- If browser-to-API calls require CORS changes, make only the minimal local-development change and cover it appropriately.
- Test successful/failed login, selection/switching, logout and session reset on reload where practical.

**Status:** Complete

**Implementation record:**

- The frontend now has public `/login`, protected `/organizations`, and protected `/` routes. Login calls the existing `POST /auth/login` contract through a small typed client. The access token and selected organization live only in React memory; refresh clears both.
- `/organizations` loads the existing authenticated organization list, supports local filtering of that small loaded list, and selects an organization. The shared sidebar switcher changes the selection at any time. No organization-scoped request exists in this checkpoint, so late-response protection is deferred to the checkpoint that adds scoped dashboard, shelter, or operation requests.
- Client-side logout clears authentication and organization state. Protected-request `401` responses also clear that state, route the user to `/login`, and show a short in-memory session-expired notice. `403`, network, and server errors use generic user-facing messages without including credentials or tokens.
- The Nest API enables CORS only when `NODE_ENV=development`, for `WEB_ORIGIN` (default `http://localhost:3001`), with `Content-Type` and `Authorization` headers. No wildcard origin or production CORS policy was added.
- Focused frontend tests cover login request handling, failed login, protected-request `401` clearing, logout state clearing, and selection-scope invalidation. Focused API tests cover the narrow development CORS policy.

### 3. Dashboard and organization overview

- Connect the selected organization to the dashboard overview and organizations page.
- Display correct counts and loading, empty and error states. Keep dashboard data scoped to the selected organization.
- Focus tests on rendering real API responses and refreshing data after a switch.

**Status:** Complete

**Implementation record:**

- The selected organization dashboard calls `GET /dashboard/organizations/:organizationId/overview` and displays the returned organization identity, operation-status counts, shelter count, and active shelter activation count.
- The overview replaces its state with a loading state whenever selection changes. Its request is aborted and its result ignored on selection change, logout, or unmount, so an earlier organization response cannot replace the current overview.
- Operations pagination and status filters remain deferred to Checkpoint 4.
- The approved ongoing-operations table is deferred to Checkpoint 4, where it will use the existing cursor-paginated operations endpoint.

### 4. Shelters and emergency operations

- Display selected-organization shelters, accurately noting the unpaginated API limitation.
- Implement status filters, cursor-based Load more and selection of current/past operations. Reset accumulated data on organization/filter changes.
- Test organization isolation in the UI, status/cursor handling, and empty/error states using focused tests.

**Status:** Complete

**Implementation record:**

- `/shelters` loads the authenticated global shelter list and filters it in the browser for the selected organization. This is documented as a development-data limitation and not an authorization boundary.
- `/operations` uses the dashboard organization-operations endpoint with its supported status filter and opaque cursor. Changing organization or status remounts the scoped list, clears earlier rows and cursors, and ignores late responses.
- The dashboard now includes a paginated active-operations table. Its Active operations, Planned operations, and Shelters cards link to the applicable implemented views. Active shelters remains an informational card because the overview API supplies only an aggregate count, not individual active-shelter identities.
- Sidebar links now navigate to all implemented dashboard views. Focused frontend tests cover sidebar/card links, status-filtered cursor pagination, and stale response handling during organization switching.

### 5. Operation detail and shelter map

- Implement the operation detail page with current affected-region list, active shelter markers, unmapped count and clear empty states.
- Configure an approved tile source and attribution. Keep Leaflet code browser-only.
- Test mapping of API data, exclusion of coordinate-free markers, selection mismatch and map/data unavailable states. No geospatial analysis or region geometry is introduced.

**Status:** Complete

**Implementation record:**

- Operations in the dashboard and operations list link to `/operations/[operationId]`. The detail page uses `GET /dashboard/emergency-operations/:operationId/map` and displays only its operation summary, current affected regions, mapped active shelters, and unmapped active-shelter count.
- The page checks the returned operation organization ID against the selected organization before displaying details. This prevents a stale or mismatched selected-organization view; it is not an authorization boundary.
- Leaflet and React Leaflet render active shelters with complete coordinates as selectable markers. The map uses OpenStreetMap standard tiles with the required visible attribution and links to the OpenStreetMap copyright page. A weather panel states that weather integration is deferred.
- The detail page has Shelters, Operations teams, People seeking help, Support units, and Approvals tabs. Only Shelters has current API data. It contains the single full shelter-detail table, total capacity only when every active shelter is represented by the API response, and an explicit `Not tracked yet` occupancy state. Other tabs state `Not available yet`.
- The dashboard includes a noninteractive Pending approvals card labelled `Not available yet`; no approval count or destination is claimed before approval data exists.
- Empty, error, not-found, unmapped-location, and late-response states are handled without inventing map geometry or shelter locations. Focused tests cover populated and empty projections, stale organization responses, operation-list navigation, and marker data handoff.

### 6. Final verification and documentation

- Run the frontend's focused tests, lint, build and any existing required checks. Run relevant API checks if local API configuration changed.
- Manually verify the full local flow: login, organization selection/switching, dashboard, shelters, operations filtering/pagination, operation map, logout and reload.
- Document setup, API URL/CORS, tile source/attribution, authentication limitations, unpaginated list limitations and intentionally deferred work.
- Mark the iteration complete only after checks and review findings are resolved.

## Out of scope

Create/edit/delete screens; notification and update feeds; tenant authorization; user/role management; refresh tokens or persistent sessions; region geometry and historical map snapshots; backend search/pagination changes; map clustering or viewport search; AI/LangGraph; protocol management; production deployment and production security hardening.

## Acceptance criteria

- Admin can log in, choose an organization and switch organizations without seeing stale results from the previously selected organization.
- Dashboard, shelters and operations reflect the selected organization; current and past operation statuses are accessible.
- Operations pagination uses the API cursor and does not mix results from different filters or organizations.
- The operation detail shows available active shelter markers, current region names and unmapped count without inventing historical or geometry data.
- Login state and organization selection are in memory only. Client-side logout is not described as token revocation.
- Screens use the approved white-and-blue direction, are responsive and accessible, and show loading, empty and error states.
- Tests and local documentation are complete; the development-only, application-wide admin boundary and scaling limitations are explicit.

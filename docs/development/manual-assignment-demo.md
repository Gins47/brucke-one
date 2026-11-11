# Synthetic manual shelter assignment demo

This local proof of concept uses **synthetic data only**. It is not a live
emergency service. Acknowledgement means the request was received, not that a
shelter was assigned or a person arrived. No email, SMS, or other notification
is delivered.

## Prepare the local environment

1. Use the pinned Node version (`nvm use` in `apps/api` and `apps/web`) and
   follow the [API setup](../../apps/api/README.md#project-setup) and
   [development ADMIN setup](../../apps/api/README.md#local-development-authentication).
   The API needs PostgreSQL with the reviewed migrations applied, Redis, and a
   development ADMIN; start the API and web app using their README instructions.
   Apply migrations only to a database you own and intend to use for the demo.
2. Confirm the web app's API URL and the API's `WEB_ORIGIN` match the local
   ports in use. Sign in to the dashboard with the configured development ADMIN.
3. Prepare a synthetic organization and an **ACTIVE** operation in a local
   demo database. The existing protected API can create them with
   `POST /organizations`, `POST /emergency-operations` and
   `POST /emergency-operations/<operation-id>/activate`; see the request
   schemas and authentication examples in the API. Record the operation UUID
   and its two-letter country code.
4. Create a synthetic physical shelter in the same organization with
   `POST /shelters`, then activate it for that operation with
   `POST /shelter-activations` using `shelterId` and `emergencyOperationId`.
   Record the activation UUID. Coordinates are optional for this workflow.
5. Create a **fresh** report with
   `PUT /shelter-activations/<activation-id>/availability` and an ADMIN bearer
   token. For example, use this body for a physical shelter with capacity at
   least 10:

   ```json
   {"operationalCapacity":10,"currentOccupancy":2,"reservedPlaces":0,"acceptingArrivals":true}
   ```

   Available places are 10 − 2 − 0 = 8. Existing manually reported reservations
   are an unattributed baseline; use a fresh zero-reservation report for this
   example. The selected operation and activation must both remain active.

## Submit a request

Replace the placeholders with the local API URL, active operation UUID and a
new UUID idempotency key. Use a different synthetic phone if necessary.

```bash
curl --request POST '<api-base-url>/public/countries/DE/help-requests' \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: <new-uuid>' \
  --data '{
    "emergencyOperationId": "<operation-uuid>",
    "requesterName": "Synthetic Demo Person",
    "requesterPhone": "000000000",
    "groupSize": 3,
    "locationDescription": "Synthetic test location",
    "canTravelIndependently": true,
    "medicalSupportNeeded": false
  }'
```

Use the operation's actual country code in the route. A successful new request
returns `201` and an acknowledgement with `PENDING_REVIEW`. Keep the same
idempotency key and body when retrying this submission. The acknowledgement is
not a shelter reservation.

## Assign and verify

1. In the dashboard, choose the organization, open the operation, and select
   **Help requests → Pending review**. Find the synthetic request, using **Load
   more** if needed.
2. Choose **Review & assign**, review the request's support and travel needs,
   select the synthetic shelter and confirm. Capacity alone does not establish
   medical suitability or safe travel.
3. Check the success message and switch to **Reserved**. The request should
   show the server-confirmed shelter and three reserved places. On the operation's
   **Shelters** tab, the sample report should now show `reservedPlaces = 3` and
   `availablePlaces = 5`; occupancy remains `2`.
4. Optionally verify the server values with an ADMIN token:

   ```bash
   curl '<api-base-url>/shelter-activations/<activation-uuid>/availability' \
     --header 'Authorization: Bearer <admin-token>'
   curl '<api-base-url>/emergency-operations/<operation-uuid>/help-requests?status=RESERVED' \
     --header 'Authorization: Bearer <admin-token>'
   ```

If capacity or request state changed, the API may return `409`; refresh and
review again. A lost response can be retried for the same request and activation
without reserving twice. Reservation expiry, cancellation, release,
reassignment and arrival registration are not implemented. Deactivating an
activation or closing an operation retains historical records; it does not
ensure that a shelter remains available.

The development ADMIN has application-wide access, not tenant isolation.
Deterministic contention testing for competing assignments, availability
updates, and parent closure remains follow-up work before real-world use.

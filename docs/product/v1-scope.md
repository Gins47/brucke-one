# Brücke One — Version 1 Product Scope

**Status:** Proposed V1 product scope (living product document)  
**Purpose:** Define the bounded V1 product outcome. Implementation sequencing belongs in `docs/iterations/`; architecture decisions belong in `docs/architecture/` and `docs/decisions/`.

## 1. Product vision

**Brücke One helps a local relief organization move an affected household to a suitable, capacity-confirmed shelter quickly and safely.**

Brucke One reduces the manual coordination burden during an active emergency. It gives operators truthful shelter availability, helps affected people provide the minimum information needed for placement, and preserves human oversight for complex or risky cases.

Brücke One is an AI-assisted shelter coordination proof of concept. It supports relief workers and official authorities; it does not replace their judgment, authority, emergency services, or public warning systems.

## 2. V1 operating model

- **One relief organization** manages multiple emergency operations and shelters.
- A physical shelter can be reused across operations through historical **shelter activations**.
- **Only one active activation per physical shelter** is permitted at a time.
- Shelter availability is operation-specific. It distinguishes operational capacity, current occupancy, confirmed reservations, and whether a shelter is accepting arrivals.
- Affected people can submit a help request themselves or through a volunteer or operator. The pilot retains only the requester name and emergency contact phone number for follow-up.
- Routine, low-risk groups of **up to 10 people** may receive an automatically confirmed placement only when all deterministic eligibility and capacity rules pass: they can reach the shelter independently, report no medical support need, and have a confirmed location.
- Groups above 10 people, requests involving medical support needs, uncertain locations, or failed matching require operator review before a reservation is made.
- Shelter volunteers verify arrivals and register people individually. This updates occupancy without losing the reservation history.
- The core workflow remains useful when AI, geocoding, or routing providers are unavailable.

## 3. Intended users

| User                             | Primary need                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Emergency operator | Monitor requests and shelter availability; handle exceptions; override decisions when needed. |
| Shelter volunteer | Verify arrivals, register individuals, and keep occupancy accurate. |
| Affected person or household representative | Request help, confirm a suitable shelter, receive clear arrival instructions and a reservation reference. |
| AI intake assistant | Collect only necessary information, translate or clarify it, and explain deterministic outcomes within defined policy limits. |

For the PoC, an administrator creates operator and shelter-volunteer accounts and assigns their credentials. This is a deliberately simple authentication model, not a complete production authorization design.

## 4. V1 capabilities (product target)

### 4.1 Emergency operations and shelter readiness

- Maintain emergency operations, affected regions, and physical shelters.
- Activate a shelter for an emergency operation while preserving historical records.
- Show operational capacity, current occupancy, confirmed reservations, derived available places, and acceptance status.
- Prevent overbooking with database-backed, concurrency-safe capacity updates and reservations.
- Show an explicit **not reported** state rather than treating missing availability as zero occupancy or available capacity.

### 4.2 Help requests and location confirmation

- Capture the minimum information needed to find a suitable shelter: group size, location, contact preference, and relevant accommodation needs.
- Retain only the requester name and emergency contact phone number for the pilot; define a retention and deletion policy before any live use.
- Accept a human-readable address, postcode, locality, landmark, or device location; never require a person to provide latitude and longitude manually.
- Geocode an address through a replaceable provider integration and require confirmation for ambiguous or approximate results.
- Treat a missing or uncertain location as an operator-review condition, not a reason to guess.

### 4.3 Deterministic matching and reservations

- Consider only shelters belonging to the relevant active operation, accepting arrivals, and able to accommodate the requested group.
- For the pilot, select the nearest **eligible** shelter: one in the active operation that is accepting arrivals and can atomically reserve enough places. Later versions may add suitability and route-travel-time ranking.
- Reserve places atomically before telling a person that placement is confirmed.
- Track reservation states, including review pending, confirmed, partially arrived, arrived, cancelled, and expired. A confirmed reservation expires 24 hours after confirmation unless it is checked in, cancelled, or extended by an operator.
- Convert reserved places to occupancy as people arrive; restore capacity when a reservation is cancelled or expires.

### 4.4 Arrival and check-in

- Provide a short-lived, signed QR code or opaque reservation reference after a confirmed placement.
- Let a shelter volunteer look up and validate an active reservation at the destination shelter.
- Support individual registration and check-in against a group reservation.
- Record who performed the check-in and when, without placing sensitive identity-document data in a QR code.

### 4.5 AI-assisted intake and operator supervision

- Use a single text-chat AI intake workflow to ask concise follow-up questions, translate where supported, structure a help request, and explain outcomes in plain language. The initial interaction language is English; the intended product direction is to translate supported user languages automatically.
- Restrict AI to typed, narrow tools; it has no direct database access and cannot invent shelter availability, routes, or policy results.
- Let deterministic domain services—not the model—validate eligibility, capacity, reservations, and status transitions.
- Automatically confirm only groups of up to 10 people that can reach the shelter independently, report no medical support need, and satisfy all eligibility, capacity, and location-confirmation checks.
- Send larger groups and defined risk conditions to an operator queue with a concise AI-generated summary and escalation reason.
- Preserve an audit trail of AI workflow decisions, tool results, reservation outcomes, operator overrides, and check-ins.

## 5. Key product principles and constraints

1. **Capacity is authoritative:** Derived availability and reservations are calculated and enforced by transactional domain logic, never by AI-generated text.
2. **Human accountability:** Operators can review and override every recommendation. Defined high-risk cases always require review.
3. **No dangerous guessing:** The system must escalate uncertain locations, unavailable capacity, unsupported needs, and failed integrations.
4. **Data minimization:** Collect only what is needed for placement and arrival. Do not put names, medical details, or identity-document data in QR codes.
5. **Explainability:** Recommendations must state the factual basis—such as available places, active operation, acceptance status, and confirmed location.
6. **Graceful degradation:** If AI, geocoding, or routing fails, operators can still create and manage requests using the core application.
7. **Traceability:** Preserve historical activations, availability reports, reservations, arrivals, and material operator decisions.
8. **Country-neutral design:** Do not assume a single address format, administrative structure, language, or identity-document format.

## 6. Explicitly outside initial V1 scope

- Replacing government emergency systems, emergency call handling, or authoritative alert providers.
- Medical diagnosis, medical triage, treatment advice, or autonomous life-safety decisions.
- Autonomous dispatch of vehicles, police, fire services, ambulances, food, medicine, or volunteers.
- Government-command ingestion, live weather/disaster feeds, and predictive evacuation modelling.
- Inventory optimisation, supplier ordering, donation management, and comprehensive logistics.
- General public social accounts, full identity-verification infrastructure, or storage of identity-document images.
- Multi-organization resource sharing and cross-NGO permissions.
- Voice, SMS, WhatsApp, or telephone integrations.
- Full offline-first synchronisation, nationwide scale, or multi-region active-active deployment.
- A multi-agent AI architecture, unrestricted RAG, or AI actions outside the defined intake and matching workflow.

These are potential future directions, not commitments for the initial release.

## 7. Initial delivery slice vs. V1

The iterations deliver thin, tested vertical slices toward this target:

| Delivery stage | Product outcome |
| --- | --- |
| Iteration 007 | Shelter availability, readiness, and shelter-focused views. |
| Future intake iteration | Structured help requests and minimal location capture. |
| Future allocation iteration | Deterministic matching, transaction-safe reservations, and operator exceptions. |
| Future arrival iteration | Reservation reference/QR flow, individual check-in, and occupancy reconciliation. |
| Future location iteration | Geocoding, location confirmation, and route comparison. |
| Future AI iteration | Single AI-assisted intake workflow with typed tools, evaluation, auditability, and human oversight. |

This product document is context, not authorization to implement all capabilities at once. Each implementation change must be explicitly limited by its active iteration and checkpoint.

## 8. V1 success criteria (to refine)

A useful V1 demonstration lets a local relief organization complete this end-to-end journey:

1. An authorized user creates an emergency operation, activates shelters, and records truthful shelter availability.
2. An affected household submits a structured help request with a confirmed usable location.
3. The system identifies eligible shelters and explains the recommendation using factual data.
4. A routine, low-risk group can receive a capacity-confirmed reservation without occupying operator time; a large, uncertain, or high-risk request appears in the operator queue.
5. The person receives clear destination and arrival information with a reservation reference or QR code.
6. A volunteer verifies the arrival, registers individuals, and the system updates occupancy safely.
7. The organization can see current occupancy, expected arrivals, available places, exceptions, and the history behind a placement.

The demonstration is successful only if it never confirms more people than the applicable shelter can accommodate.

## 9. Open product decisions

- The current auto-assignment policy is groups of up to 10 people that can reach the shelter independently, report no medical support need, and have a confirmed location. Which further conditions should later be added?
- The pilot matches the nearest eligible shelter. Which accommodation needs should later become structured, deterministic matching criteria?
- A reservation currently expires after 24 hours. Should emergency-operation type or travel time later affect that duration?
- The pilot keeps requester name and emergency contact phone number. What retention and deletion policy is required before a live pilot?
- The initial AI flow is English text chat with intended automatic translation for supported user languages. Which languages should be prioritised, and when should voice be introduced?
- Google Maps Platform is the PoC geocoding and routing provider. What fallback is required before a live pilot?
- The PoC lets an admin create credentials for operators and shelter volunteers. What role and authentication model is required before a live pilot?
- Service availability, privacy, security, and legal acceptance requirements are deferred because this is a PoC; they must be defined before real-world use.

## 10. Documentation boundaries

- **Product:** `docs/product/v1-scope.md` — user needs, capabilities, exclusions, success criteria.
- **Architecture:** `docs/architecture/overview.md` — system structure, boundaries, and technical direction.
- **Decisions:** `docs/decisions/` — rationale for significant choices.
- **Iterations:** `docs/iterations/` — authorized implementation scope and checkpoints.

**Agent rule:** Treat this document as product context, not as permission to implement features outside the active iteration checkpoint.

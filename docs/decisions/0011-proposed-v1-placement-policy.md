# ADR 0011 — Proposed V1 placement and AI boundaries

**Status:** Proposed product direction, not implemented or independently approved by this record. Recorded retrospectively on 2026-11-10.

## Context and direction

The living [V1 product scope](../product/v1-scope.md) describes a shelter-placement outcome: deterministic eligibility and capacity checks, nearest eligible shelter selection, a 24-hour reservation expiry, and human review for groups above ten people, medical-support needs, uncertain locations, or failed matching. Automatic confirmation is limited to groups of up to ten that can travel independently, report no medical support need, and have a confirmed location.

AI is intended to help with intake, translation, and explanations using narrow tools; it must not directly bypass authorization or determine capacity. Geocoding, routing, operator overrides, reservations, and arrival/check-in have separate future delivery slices. The product scope names Google Maps Platform as the PoC geocoding/routing direction; no provider integration is established by this record.

## Consequences and open questions

The product scope remains proposed and is not proof that these workflows exist or permission to implement them. Matching criteria, policy refinements, location/provider fallback, personal-data retention, and production safety requirements need further design. Current public intake collects an optional email as documented by Iteration 008; the product document's pilot-retention language needs reconciliation before live use.

## Evidence

- [V1 operating model, capabilities, and open decisions](../product/v1-scope.md)
- [Iteration 008 implemented boundaries](../iterations/008-public-help-request-intake.md)

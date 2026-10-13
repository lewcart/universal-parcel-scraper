# Saia

Tracks freight through the HTTP service behind Saia's public tracker. The adapter opens a
fresh tracking session, then sends the encrypted PRO with the session's XSRF cookie and the
shared API and cipher keys published in the tracker's script. No customer account is used.
A failed connection gets one more attempt within the lookup budget.

The reply must name the requested PRO. Only the service's missing-shipment notice for that
PRO is not-found. Refused sessions, firewall blocks, rate limits and malformed replies stay
separate. A twelve-digit input is looked up as its first eleven digits, as the page does;
recognition accepts only the whole identifier the reply confirms.

Scan clocks have no offsets and remain local. The shipment's status can be newer than its
history. The adapter keeps terminal locations, the estimate and weight, and excludes parties,
signatures, document links and driver details.

Saia's firewall refuses some networks and browser clients. Those failures can pass to enabled
universal providers. The service also warns against unauthorized API access; the adapter uses
the public tracker's request and shared keys.

Set `SAIA_TRACKING_NUMBER` outside the repository and run
`npm run test:carriers:live -- carriers/saia/adapter.live.test.ts`.
`SAIA_UNKNOWN_NUMBER` optionally checks an unknown PRO.

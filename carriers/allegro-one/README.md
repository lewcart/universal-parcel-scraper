# Allegro One

Allegro's own delivery network in Poland: One Box lockers, One Punkt pickup points and One
Kurier couriers. Tracked through the service Allegro's tracking page asks on Allegro's edge
gateway.

## How it works

1. `direct`: one `GET https://edge.allegro.pl/one/tracking?packageNo={number}` with
   `Accept: application/vnd.allegro.internal.v1+json` and `Accept-Language: en-US`. Allegro
   One's tracking page asks this service; it needs no cookies, key, account or browser. The reply
   lists the parcel's scans, each a UTC instant and a wording.
2. `retry`: one more try when the request fails to reach Allegro or hangs. The first try gets
   half of the budget.

- The reply does not echo the number: the scans are those of the number in the request.
- An empty or null list is what the tracker shows as not found. Every A0 number seen lists scans
  from its label on, so an empty list for an A0 number is `NotFoundError`. Every real AD number
  seen got an empty list, so for AD numbers and the older ALE form it is `NoHistoryError`.
- A refused request (HTTP 400 or 406), the gateway's "Feature unavailable" 404 for a retired
  route, a redirect, a bot check and malformed replies keep their own kinds; none is not found.
- Recognition makes the same request. `allegro-one-1` claims these numbers at high confidence,
  so preflight does not ask it.

## Notes

- `allegro.pl` sits behind DataDome, which blocks automated browsers and plain HTTP clients
  alike. The edge gateway does not.
- The gateway answers only Allegro's own media type; another `Accept` gets HTTP 406.
- The service words scans in English for `en-US` and in Polish for `pl-PL`, a bare `en` or `*`,
  which Node's fetch sends by default. The stage map reads the English wording.
- The service sends no status code, so the map stages each wording. A scan the map does not know
  is left to the shared wording rules.
- The Allegro Delivery tracking page asks `/ad/tracking` instead, which answers the same lists.

## Numbers

Allegro One numbers are ten letters and digits starting `A0`; Allegro Delivery numbers start
`AD`. `allegro-one-1` claims `A0` or `AD` followed by eight letters and digits. The tracker also
answers an older form, `ALE` and twelve digits, which the adapter takes but detection does not
offer. Allegro publishes no check digit.

## Links

`allegro.pl/allegrodelivery/sledzenie-paczki?numer={number}` and the older
`allegro.pl/kampania/one/kurier/sledzenie-paczki?numer={number}` open the tracker with the number.

## Limitations

- No location, pickup point, delivery estimate, weight, service, sender or recipient.
- Allegro Delivery's AD numbers get an empty list.

## Testing

`ALLEGRO_ONE_TRACKING_NUMBER=... ALLEGRO_ONE_UNKNOWN_NUMBER=... npm run test:carriers:live -- carriers/allegro-one`

# Portless

Portless is a fulfilment company that ships online orders from its warehouses in Asia to buyers
abroad, where a local carrier delivers them. Its shipping emails link to its tracking page,
`ordertrackingupdates.com/track/{number}`, which AfterShip hosts under Portless's account. The page
tracks a parcel under its last-mile carrier's number and shows the checkpoints of the first mile
before that carrier has scanned it.

## How it works

1. `direct`: one `GET https://username.aftership.com/trpc/trackings.getTrackingWithTrackingNumber`
   with `input` set to `{"organization_id": "<Portless's account>", "translate_to": "en",
   "tracking_number": "{number}"}`, the lookup the page is built on. It needs no cookie, token, key
   or browser. The account id is in every visitor's page state, the same for all of them.
2. `retry`: the same read once more when the lookup cannot be reached.

- A number the page does not hold gets HTTP 200 with `{"result":{"data":{"errorCode":40414}}}`,
  which is not found. Another error code is inconclusive. A redirect or a missing route is a moved
  lookup.
- The reply must name the number asked.

## Notes

- Each checkpoint's `checkpoint_time` is an instant with its offset, which is kept.
- Each checkpoint carries one of AfterShip's published sub-statuses, such as `InfoReceived_001`,
  kept as its provider code. The code decides the stage where it is specific, with 17TRACK's
  safeguards: generic transit yields to the wording, a delivery code to wording read as another
  stage, and a customs code to wording that says customs is done. The rows seen are in
  [`statuses.json`](statuses.json). The reply's summary status is not read; the checkpoints decide.
- The page lists the first mile's checkpoints and, once it has started, the last mile's, oldest
  first. Of one instant, the later listed is the newer.
- The last-mile carrier is named from `multiple_fulfilled_carriers.last_mile` only when the catalog
  knows it by its name and tracking link and its rules offer the number given; that number is the
  delivery number when it differs.
- The estimate is the delivery window the page shows, `latest_estimated_delivery`, kept until the
  parcel is delivered or returned.

## Limitations

- No detection: Portless's numbers are its delivery carriers' numbers, so a number alone selects
  that carrier. Portless's tracking links select Portless.
- The signatory and proof of delivery the page can show are never kept, nor are the order and
  addresses the reply can carry.

## Testing

`npm run test:carriers:live -- carriers/portless`, with `PORTLESS_TRACKING_NUMBER` and
optionally `PORTLESS_UNKNOWN_NUMBER` set outside the repository.

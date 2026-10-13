# XPO

Tracks XPO's less-than-truckload freight in the United States, Canada and Mexico through XPO's
former PRO tracking pages on `ltl.xpo.com`.

## How it works

The server still renders the former tracking pages for a plain request; only their script sends
a browser on to the current tracker. The adapter makes GETs, one at a time, without an account,
key, cookie, CAPTCHA token or browser:

1. `TrackingRS.jsp?PRO={number}` gives the summary: the status code and wording, the last update,
   the estimated delivery day and the weight.
2. When the US system does not know the PRO, `TrackingRS.jsp?rptMX=MX&PRO={number}` asks the
   Mexico system, which the not-found page links to. A PRO is missing only when both say so.
3. `ShipmentHistory.jsp`, with the parameters of the summary's own link, gives the scans.

A request that fails to reach XPO, or hangs, is sent once more within the budget. Recognition
reads the summary alone.

The summary must name the PRO asked for in its status block, and the history in its heading. The
not-found notice names the US system's eleven-digit form of the PRO, or the PRO itself from the
Mexico system; a notice for another PRO is a malformed reply. XPO's firewall answers HTTP 200
with a rejection sentence, which is a block, not a missing shipment. Rate limits and other HTTP
errors keep their own failure kinds.

## Numbers

PROs are nine digits, the last the remainder of the first eight divided by seven, which
`xpo-ltl-1` checks. TNT's nine-digit consignment numbers can carry the same check, so detection
offers both carriers and recognition decides.

## Notes

- The current tracker on `ext-web.ltl-xpo.com` shows guest results only after a reCAPTCHA
  checkbox the server enforces, and the API it calls on `api.ltl.xpo.com` sits behind a bot
  defense wall. XPO's developer API needs a customer account. These stay leads.
- The summary's status code gives the stage, mapped in [status.ts](status.ts). Notices such as
  a document that can be viewed, and the parent of a split shipment, say nothing about the
  freight; then a final delivery among the scans, or else the newest staged scan, decides.
- Clocks are service-center wall clocks without an offset and are kept as local times. Some
  service centers stamp the zone of another, so no zone is assigned.
- Lookups, record saves and the system's unload of a delivered shipment are bookkeeping and are
  left out. The pickup-and-delivery route after a description is cut off. Identical rows are kept
  once.
- The estimated day is dropped once the freight is delivered.
- The summary also shows the shipper, consignee and bill-to parties, references, piece counts and
  document links, and the history the delivery route. None of them is read.

## Limitations

XPO says the former tracking tool is being discontinued; when it goes, so does this route. The
pages give no offsets, so results carry local times only and no delivery instant. No found
shipment from the Mexico system was seen.

## Links

The tracking field on `xpo.com` hands PROs to the current tracker, which reads them from
`?referenceNumber=` on `ext-web.ltl-xpo.com/public-app/shipments`. Guest results sit behind the
CAPTCHA, so number forwarding cannot be verified.

## Live test

Set `XPO_LTL_TRACKING_NUMBER` outside the repository and run
`npm run test:carriers:live -- carriers/xpo-ltl/adapter.live.test.ts`.
Optionally set `XPO_LTL_UNKNOWN_NUMBER` to check a PRO XPO does not know.

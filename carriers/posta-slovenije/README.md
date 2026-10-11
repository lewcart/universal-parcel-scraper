# Pošta Slovenije

Tracks Pošta Slovenije items, its own and those other posts send to Slovenia, through the guest
lookup of its official MojaPošta app.

## How it works

The web tracker on `moja.posta.si/tracking` and the app ask the same service,
`GET https://moja.posta.si/api/v1/parcels/track/?TrackingNumber={number}`. The web tracker sends an
invisible reCAPTCHA token in `X-ReCaptchaResponse`; the app sends none, and the service answers a
client whose User-Agent names the app, `MojaPosta/{version} ({platform})`, without an account,
key, cookie or token. Other clients without a token are refused. The adapter sends the app's
User-Agent and no Content-Type, which the service would read as an empty JSON body and refuse; a
request that fails to reach Pošta Slovenije is sent once more within the budget.

The reply must name the whole requested number. A number the service does not know comes back
as HTTP 404 with a notice naming it, so it is not found; any other 404 is a transport failure. The
service's refusal and block pages are challenges, and other HTTP errors and malformed replies keep
their own failure kinds. Recognition uses the same lookup.

## Numbers

The adapter takes UPU S10 codes with a valid check digit and treats anything else as invalid
without a request. A code ending `SI` is Pošta Slovenije's, but the issuer of an S10 code does not
establish who delivers it, so detection keeps such codes with the generic postal carrier, and the
low-confidence `posta-slovenije-s10` rule makes preflight ask Pošta Slovenije about them.

## Notes

Each scan has a code of Pošta Slovenije's own, Slovenian and English wording, a detail line and,
after a failed delivery, the next step. The adapter maps the codes, keeps the code and reads the
English wording, else the Slovenian. A failed pickup whose next step sends the item back to its
sender is an exception, and a delivery after it reaches the sender, so it reads as returned.
Clocks are UTC instants.

A scan's place is the post office's name; its number, a postcode, is dropped. The pickup point is
the post office an item waits at, or was collected from. The recipient, the signatory, the scan's
note, sender and recipient details, locker and post office addresses and pickup codes are not read.
A reply without scans is read from the item's own heading as a summary.

## Limitations

The service lists no forwarding scans between sorting centres, which some universal providers
relay. The reply has no delivery estimate or weight.

## Links

The tracker moved from `sledenje.posta.si` to the MojaPošta app, whose script reads a number from
`?trackingNumber=` on `moja.posta.si/tracking`.

## Live test

Set `POSTA_SLOVENIJE_TRACKING_NUMBER` outside the repository and run
`npm run test:carriers:live -- carriers/posta-slovenije/adapter.live.test.ts`.
Optionally set `POSTA_SLOVENIJE_UNKNOWN_NUMBER` to check a number the service does not know.

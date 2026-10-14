# Magyar Posta

Tracks Magyar Posta and MPL items through the public tracker at
[posta.hu](https://www.posta.hu/nyomkovetes/nyitooldal), driven by the TRAWL browser service:
domestic MPL parcels, S10 items Magyar Posta issues, and items from other posts it delivers.

## Numbers

Domestic MPL numbers are `P`, a product letter, a three-character customer code, seven digits
and a check digit. The seven digits weigh 3 and 1 alternately from the left, and their sum mod 10
is the check digit; the MPL API guides' examples and the public numbers pass it. Such a number is a
suggestion led by Magyar Posta; one with a numeric customer code also fits La Poste's
two-characters-and-eleven-digits rule. S10 items ending in `HU` stay with the generic postal
carrier, which lists Magyar Posta first among the direct carriers.

## How it works

1. `trawl`: the helper [`magyar-posta-browser.mjs`](../../trawl/magyar-posta-browser.mjs) opens
   the tracker the public page frames, `www.posta.hu/ikrnyomkovproxy/`, in a fresh context. It
   fills the number in, solves the reCAPTCHA checkbox with TRAWL's solver, searches, and keeps
   the result page the search for that number redirects to, without scripts or form tokens.

Every search needs a new checkbox answer, so there is no plain HTTP route, and recognition does
not ask Magyar Posta. A search the tracker refuses comes back as its form without a redirect,
which is a challenge.

The tracker answers in the language the browser asks for. The helper sets the tracker's own
Hungarian language cookie, and the parser and status map read Hungarian. The result must name
the whole number in its search field, its item and the item's log.

The widget takes the tracker's language, which stays Hungarian for the parser, and TRAWL's solver
reads only English refusals. The helper watches the challenge frame and stops the solve as soon as
Google asks for more answers or shows its automated-traffic page. An unsolved checkbox ends before
the browser deadline. Either is a challenge, and after Google's refusal lookups fail as a challenge
for ten minutes without opening a browser.

## Notes

- Each scan's icon carries the tracker's category: 1 acceptance, 2 processing, 3 transport,
  4 delivery and 5 delivered. It is the event's `provider_code`. The wording refines it, following
  Magyar Posta's [event list](https://www.posta.hu/static/internet/download/Nyomkovetesi_esemenyek.pdf):
  an item announced by its sender is registered, an undeliverable item on its way back is
  returned, and a delivery after a return is the return's end. Category 4 has no stage of its own.
- Cash-on-delivery settlements with the sender come after the delivery and move nothing, so they
  are left out. Repeated delivery rows count once.
- Clocks are Budapest wall clocks without an offset. Events get `local_time` and the result
  `last_update_local`.
- A parcel's details name its service. The post office, PostaPont or locker an item waited at is
  its pickup point. The line naming who received an item is dropped.
- The tracker's notice for the number is not found. A block page or a 401/403 is a challenge,
  429 is rate limited, and 404/410 means the tracker is unavailable.
- Not used: the MPL tracking API on `core.api.posta.hu` needs a business client id and secret.
  The Posta app's guest API under `net.posta.hu/mpl/public/api/mobile/guest` adds a number only
  with an invisible reCAPTCHA Enterprise token, and the previous app's `PostaWeb/TrackingInfo`
  read is refused by the site's firewall.
- The page's `?searchvalue=` link fills the number into the tracker's search; the visitor still
  ticks the checkbox.

## Limitations

- Lookups need a TRAWL image that includes the helper.
- Google's audio challenge can refuse the server's address. Lookups then fall back to the
  universal providers.
- At most 100 scans are kept.

## Testing

`npm run test:carriers:live -- carriers/magyar-posta` with `FLARESOLVERR_URL` and
`MAGYAR_POSTA_TRACKING_NUMBER`. Optionally set `MAGYAR_POSTA_UNKNOWN_NUMBER` to check the
not-found notice.

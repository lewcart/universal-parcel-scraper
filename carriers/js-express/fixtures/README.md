# Fixtures

The pages follow the tracking page the home page's form opens for one number: the form again with
the number filled in, then the scans newest first by wall clock, each a time, a place in 【…】 and a
wording. Each page also carries the page's captcha dialog and Cloudflare's script, as every answer
does.

- `delivered.html` is a parcel flown to Canada with a connecting flight and delivered by a courier
  there, whose wording repeats the place with its province. It has a delivery forecast, two
  partners' records of the parcel's data and a row listed twice.
- `in-transit.html` is a parcel flown from Hong Kong to Amsterdam and announced by the airport's
  ground handling agent, with partners' records of the parcel's data.
- `not-found.html` is the page's answer for a number the tracker does not know.

Numbers, places and clocks are invented.

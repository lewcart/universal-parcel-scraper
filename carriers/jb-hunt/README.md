# J.B. Hunt

J.B. Hunt shipments use enabled universal providers. There is no dedicated adapter.

J.B. Hunt Transport Services, of Lowell, Arkansas, runs truckload, intermodal, less-than-truckload
and final mile delivery; its final mile service brings large items to homes. Its site is
jbhunt.com.

## Numbers

J.B. Hunt publishes no tracking number format, and no public page shows one of its numbers, so
there is no rule.

## Why there is no adapter

None is built. Its home delivery tracker on jbhunt.com checks each search with reCAPTCHA before
asking its API, `ww5.jbhunt.com/api/finalmile/lookuprequest`, which refuses a search without a
reCAPTCHA Enterprise token. Business freight is tracked on a separate page of the site, which loads
reCAPTCHA Enterprise too.

## Links

A jbhunt.com link to `/shippers/final-mile-services/track-shipments/` with a `tracking` parameter
names J.B. Hunt.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

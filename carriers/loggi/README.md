# Loggi

Loggi parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Loggi's tracker takes an eight-character tracking code of capital letters and digits. Lookups
archived from the tracker show them, and its page names that part of the address the tracking
code. Eight characters are a shape several carriers share, so no rule claims them. Older
lookups put a merchant's own reference after a merchant key, or Loggi's internal package
number; neither is a tracking code.

## Links

`app.loggi.com/rastreador/{code}` shows one parcel after a robot check, and the tracker on
`loggi.com/rastreador/` embeds the same page. The library reads the code from those addresses
but builds none, because the robot check hides the search field from automated checks.

The robot check is Cloudflare's checkbox, before every tracker address loads. Loggi's server
then writes the parcel into the page, so there is no lookup of its own to call, and Loggi's app
opens the same page. No adapter reads it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

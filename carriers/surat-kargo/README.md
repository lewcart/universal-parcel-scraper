# Sürat Kargo

Sürat Kargo parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

The tracker and customers use fourteen-digit tracking numbers. Fourteen digits are shared with
Russian Post and other carriers, and no checksum is known, so no rule claims them. The tracker
also takes the sender's web order code, which is not a tracking number.

## Links

The tracker reads the number from `kargotakipno`, so
`suratkargo.com.tr/KargoTakip/?kargotakipno={number}` opens one parcel, as archived lookups
show.

## Why there is no adapter

The tracker and Sürat Kargo's other web hosts refuse requests from outside Türkiye: from
Europe, the Americas and Asia, Cloudflare answers HTTP 403 with its block page, while Turkish
networks get the tracker. Its search form asks for a security code, but archived lookups show
the link above opening a parcel without one. The tracking app Sürat Kargo once published read
an API host that no longer resolves, and no current app tracks parcels, so Sürat Kargo stays on
universal providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

# Instabox

Instabox parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Instabox parcel IDs looked up through its former tracking API are two letters and ten or twelve
digits, the digits starting `01` or `02`; the letters vary between parcels. Two letters and ten
digits are already shapes of Amazon, J&T, Relais Colis and Colis Privé numbers, so no rule
claims the layout and the user picks Instabox.

## Links

Instabox's tracker at `track.instabox.com` asks for the parcel ID together with the recipient's
email address or phone number, so no link opens one parcel.

## Why there is no adapter

The tracker is the Instabee group's consumer web app, which also serves Budbee at
`track.budbee.com`. Every parcel address leads to a verification page. The parcel opens only
after a search that names the recipient's email address or phone number, or through the
`authCode` in the recipient's notification link. The search gives an unknown parcel and a wrong
email or phone the same notice.

The Instabox app (`io.instabox.consumer`) reads orders from `tracking-api.instabee.com`, which
answers an order lookup only with that `authCode` or for a signed-in user who owns the order.
Budbee's earlier tracker at `tracking.budbee.com` reads orders by the token in the recipient's
link, and its order search also needs the email address or phone number. Archived lookups went
to an unauthenticated tracking API on `tracking-api.instabox.se`, a host that no longer resolves.

A lookup takes no email address or phone number, so Instabox stays on universal providers.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).

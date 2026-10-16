# Upaya

Upaya parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Upaya's tracker asks for the tracking code from the SMS. Its example has six letters, five
digits, a hyphen and seven digits, and a merchant's open-source integration shows a code of the
same layout with four digits before the hyphen. `upaya-1` claims the layout when it is typed
with its hyphen; without it the code fits Colis Privé's broad shape.

## Links

Upaya's tracking form sends the code as `tracking` to `upaya.com.np/track/`, so
`upaya.com.np/track/?tracking={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

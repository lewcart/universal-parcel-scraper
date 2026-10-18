# TMM Express

TMM Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

TMM Express is a Ukrainian courier that brings parcels into Ukraine through its Warsaw hub and
delivers them inside the country; its booking form lists Poland, Luxembourg and Belarus as
origins. The tracker asks for the AWB number. Archived lookups on it show ten-digit numbers for
both imports and domestic parcels. No rule claims them: ten digits are DHL Express's waybill
length and several other carriers print them too.

## Links

The tracker opens one parcel at
`ukr.tmm-express.com/en/trackparcels?num={number}&mark=is_code`, where `mark=is_code` says the
input is an AWB number. Archived lookups use the same path in Russian and Ukrainian and on the
bare and `www` hosts, so the library reads `num` on `trackparcels` pages of any TMM Express
host. The number field itself is the form at `ukr.tmm-express.com/en/callback`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

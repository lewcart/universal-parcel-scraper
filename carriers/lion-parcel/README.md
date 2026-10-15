# Lion Parcel

Lion Parcel parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lion Parcel STT numbers are two digits, `LP` and thirteen digits. They appear in archived
lookups on Lion Parcel's tracker and its tracking API, in complaints that name Lion Parcel and
in Indonesian tracking guides, with the prefixes `11`, `88` and `99`. Rule `lion-parcel-1`
claims the layout with high confidence because the `LP` infix points to Lion Parcel alone.
Colis Privé's broad seventeen-character rule also takes many of these numbers, which the
collision registry records.

## Links

Lion Parcel's tracker builds `lionparcel.com/track/stt?q={number}` and opens the parcel from
the `q` parameter, which takes several numbers separated by commas; the library reads the
number from that address and from its `/my/track/stt` variant. The lookup behind it asks for a
CAPTCHA token.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

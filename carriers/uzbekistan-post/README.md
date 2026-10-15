# Uzbekistan Post

Uzbekistan Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Uzbekistan Post prints UPU S10 numbers ending in `UZ`. Archived lookups on its tracker show
items starting `MM`, `LA` and `RX`. Generic postal detection handles S10 numbers, so Uzbekistan
Post has no rule of its own. The tracker also answers foreign posts' items and the post's
hybrid-mail references; those are not Uzbekistan Post parcel numbers.

## Links

uz.post opens one parcel at `/tracking/{number}`, with an optional `ru` or `uz` language
prefix, and older lookups pass the number in the `search` parameter. pochta.uz now sends
visitors to uz.post.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

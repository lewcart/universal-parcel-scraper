# PEC

PEC parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Archived lookups on PEC's tracker use twelve-digit cargo codes, sometimes typed in groups of
four. PEC's API documentation also gives a thirteen-digit cargo code; piece barcodes add four
digits to the cargo barcode. These digit runs are shared with many carriers, so no rule claims
them. PEC also writes cargo codes as Cyrillic route letters, a sequence number and a day and
month, such as a code ending in `-1/1102`. The library accepts only Latin letters and digits,
so those codes are not supported.

## Links

The tracker's structured data gives `pecom.ru/services-are/order-status/?code={number}`, which
opens one cargo.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

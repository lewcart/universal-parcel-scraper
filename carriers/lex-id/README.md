# LEX Indonesia

LEX Indonesia parcels use enabled universal providers. There is no dedicated adapter.

LEX Indonesia, run by PT Lastana Express Indonesia in Jakarta, is the Lazada marketplace's delivery
network in Indonesia, founded with Lazada in 2012. Its site is lex.co.id.
[LEX Malaysia](../lex-my/README.md) and [LEX Vietnam](../lex-vn/README.md) are separate entries.

## Numbers

Its waybills are LXAD, a hyphen and ten digits. Buyers' and sellers' complaint letters on a consumer
site show them, from different writers over several years, so `lex-id-1` suggests LEX Indonesia at
high confidence.

## Why there is no adapter

Its tracking page posts numbers to an open JSON endpoint, on the platform LEX Malaysia and LEX
Vietnam also use, without a login or CAPTCHA, and answers an unknown number with an empty list. It
finds a number only with its hyphen. Without the last four digits of the recipient's phone number,
its history endpoint gave a delivered parcel's status but no scans. An adapter can follow.

## Links

The tracking page reads numbers as `references` from its address, but finds one only with the hyphen
after LXAD, which detection removes, so there are no tracking links.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

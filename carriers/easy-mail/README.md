# Easy Mail

Easy Mail parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Easy Mail vouchers are eleven digits, and the tracker prints them with a leading zero as twelve
digits. Archived lookups on Easy Mail's tracker and web-tracking page show them. No rule claims
them: Courier Center and other carriers print numbers of the same lengths, so the shape alone
cannot name Easy Mail.

## Links

The tracker opens one parcel at its address followed by the voucher, and the website's
web-tracking page passes the voucher as `tracking_number`. Both are read as links. The
tracker's own search form posts the voucher behind a reCAPTCHA.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

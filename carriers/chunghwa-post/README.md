# Chunghwa Post

Chunghwa Post parcels use enabled universal providers. There is no dedicated adapter.

Chunghwa Post (中華郵政) is Taiwan's national post.

## Numbers

International items carry a UPU S10 number ending in `TW`. Generic postal detection handles S10
numbers, as for other posts without a dedicated adapter, so no Chunghwa Post rule claims them.
Domestic registered letters and parcels use bare fourteen- or twenty-digit numbers, shapes
shared with other carriers, so no rule claims them either.

## Links

The former lookup on `postserv.post.gov.tw/webpost/CSController` took the number in `MAILNO`.
The current tracker asks for a CAPTCHA, so no address opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

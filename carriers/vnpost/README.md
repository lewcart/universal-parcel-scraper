# VNPost

Vietnam Post (VNPost) parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

VNPost numbers domestic and international items alike with UPU S10 numbers ending `VN`, as
lookups archived from VNPost's tracking page show. Postal detection handles them, so VNPost
has no rule of its own.

## Links

VNPost's former tracking page put the number in the path after `/dinh-vi/buu-pham/key/`, and
the library reads it from such addresses. The current form asks for a captcha, so the library
builds no address.

The current form is on `vnpost.vn/vi`. Its public `homeCtrl.js` opens a Laravel session,
gets an image address from `/handle-captcha/refresh-captcha`, then sends the whole number
and image answer to `/postcode/thong-tin` as `post_code` and `captcha`. The deployed `mews`
driver uses a four-character JPEG, rather than reCAPTCHA. Invalid-number validation alone
does not establish that verification passed or show the tracking response's history layout.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

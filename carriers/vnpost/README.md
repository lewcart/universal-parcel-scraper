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

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

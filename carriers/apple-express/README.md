# Apple Express

Apple Express parcels use enabled universal providers. There is no dedicated adapter.

Apple Express is a courier founded in 1985 in the Toronto area that runs same-day, last-mile
and residential parcel delivery across Canada and in parts of the United States. SprintStar
was its residential parcel brand, and SprintStar's old tracker now points to Apple Express.

## Numbers

Apple Express order numbers are eight digits, a run many carriers share, so no rule claims
them. The tracker also opens a parcel from a shipper's reference: `APPL` followed by thirteen
digits, which `apple-express-1` claims, or Cainiao's own references for marketplace parcels,
which AliExpress detection keeps.

## Links

The tracker opens `track.appleexpress.com/orderNumber/{number}`, optionally after a language
segment such as `en-CA`, and `/reference/{reference}` for a shipper's reference. The older
`goapple.appleexpress.com` pages and SprintStar's tracker carried the order number in
`OrderNo`; the library reads the number from all of them.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

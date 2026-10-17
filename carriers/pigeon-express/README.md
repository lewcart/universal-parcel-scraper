# Pigeon Express

Pigeon Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Pigeon Express is a Bulgarian courier. A shipment's reference number has twelve digits, and
each package label adds a dash and the package index. Its API documentation gives both forms;
only its shipment detail endpoint takes the package barcode. A redirected or returned shipment
continues under a new reference number.

Twelve digits are shared with FedEx and many other carriers, and the package barcode reads as
thirteen digits once the dash is stripped, so no rule claims either form.

## Links

The public tracker opens one shipment from its `tracking_number` parameter, as the API
documentation describes.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

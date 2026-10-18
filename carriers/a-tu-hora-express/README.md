# A Tu Hora Express

A Tu Hora Express parcels use enabled universal providers. There is no dedicated adapter.

A Tu Hora Express is a Spanish home delivery network that carries parcels for retailers and
marketplaces such as Zara, Temu and AliExpress.

## Numbers

The tracker takes a shipment code of 10, 16 or 24 digits and pads a ten-digit code with six
leading zeros to the sixteen-digit form. Public consumer complaints give all three lengths. The
24-digit form is the sixteen-digit number, `001` and the five-digit delivery postcode.

`a-tu-hora-express-1` suggests the zero-padded sixteen-digit form and `a-tu-hora-express-2` the
24-digit form. Both stay low because other carriers print numbers of the same lengths. Ten
digits stay unclaimed: many carriers share that length.

## Links

The tracker on mydelivery.atuhoraexpress.com asks for the shipment code and the delivery
postcode, then opens the parcel under an internal identifier, so no address opens one parcel
from its number.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

# FG Delivery

FG Delivery parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

FG Delivery is the parcel brand of Fulmine Group, an Italian postal operator. Its help pages
say its own shipment codes start with FGD. No public example of one was found, so no rule
claims them.

AliExpress parcels it delivers carry Cainiao's Italian codes: CNIT, two letters, eight digits
and the suffix FLM, which names Fulmine. Customers quote them in complaints the company
answers. `fg-delivery-1` claims that layout.

## Links

The tracking page reads the number from its `barcode` parameter and looks it up at once, so
`fgdelivery.it/tracciabilita/?barcode={number}` opens one parcel. It shows the last outcome and
its date, not a history.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

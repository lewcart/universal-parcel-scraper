# Forza Delivery Express

Forza Delivery Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Forza guías are `FD` followed by digits. The carrier's tracking form fixes the `FD` series and
takes the digits, and customers quote six to eight digits, often with a space or a dash after
`FD`. `forza-delivery-1` claims `FD` and six to eight digits with low confidence, because GLS,
Loggi and R+L Carriers suggest overlapping shapes.

## Links

The tracker opens one guía at `rastreo.forzadelivery.com/` followed by the guía, an address
Forza's own site builds. The tracker drops `FD` from the address and adds it back, so the
address works with or without the prefix.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

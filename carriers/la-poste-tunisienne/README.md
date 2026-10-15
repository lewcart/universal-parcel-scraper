# La Poste Tunisienne

La Poste Tunisienne parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

La Poste Tunisienne and its express service Rapid-Poste track letters, parcels and EMS items,
domestic and international, by UPU S10 numbers ending in `TN`. Generic postal detection
handles these numbers, so no rule for La Poste Tunisienne claims them. International EMS
items handed to DHL also show a DHL waybill on the tracker; that number is DHL's.

## Links

Rapid-Poste's tracker and the earlier e-suivi tracker read a number from `ItemId` on
`Item_Events.asp`, under `/fr/`, `/an/` and `/ar/` for French, English and Arabic.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

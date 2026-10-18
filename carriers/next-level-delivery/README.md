# Next Level

Next Level parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Next Level is a Bulgarian courier that delivers across Bulgaria and, through subcontractors, to
Greece, Romania and other Central and Southeastern European countries. Its API reference shows
thirteen-digit shipment numbers and an eight-digit number for a return shipment. No rule claims
them: thirteen and eight digits are plain digit runs other carriers print too.

When a subcontractor delivers abroad, the tracker also shows the subcontractor's waybill and
finds the shipment by it.

## Links

The tracker opens one parcel at `nextlevel.delivery/track?awb={number}`, the tracking link the
API returns. The page also takes several numbers separated by commas in `awb`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

# La Poste du Sénégal

La Poste du Sénégal parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

International letters and parcels carry UPU S10 numbers ending in `SN`. Generic postal
detection handles these numbers, so no rule for La Poste du Sénégal claims them.

Jotnaci, the domestic goods service, numbers its items with `JT` and thirteen digits. J&T
Express prints the same layout, so no rule claims Jotnaci numbers either.

## Links

The tracker at `laposte.sn/suivi-colis/` looks the number up through a request the page sends
and has no address for one item.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

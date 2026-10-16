# La Poste de Côte d'Ivoire

La Poste de Côte d'Ivoire parcels use enabled universal providers. There is no dedicated
adapter.

## Numbers

La Poste de Côte d'Ivoire's letters, parcels and EMS items carry UPU S10 numbers ending in
`CI`. Generic postal detection handles these numbers, so no rule for La Poste de Côte d'Ivoire
claims them. Inbound items keep the number of the post that sent them.

## Links

The tracker at `laposte.ci.post/tracking-colis` posts the number in a form and has no address
for one item.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

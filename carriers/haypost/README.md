# HayPost

HayPost parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

HayPost items carry UPU S10 numbers ending in `AM`, which generic postal detection handles.
Orders created through HayPost's business API carry ids of `PAS`, nine digits and `AM`; one
public example is too little for a rule, so HayPost has no rule of its own.

## Links

haypost.am's tracking page reads the number from the address fragment after `/track-trace#`,
which its own search form writes. Detection cannot read a fragment, so there is no link rule.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

# Poșta Română

Poșta Română items use enabled universal providers. There is no dedicated adapter.

## Numbers

Poșta Română prints UPU S10 numbers, two letters, nine digits and two letters, ending in `RO`.
They stay with the generic postal carrier; no rule of its own is needed. Its tracker also
follows items from other posts while they are in Romania, and takes numbers of two letters and
eleven digits, as archived lookups show. That shape is shared with other carriers, so no rule
claims it.

## Links

The tracker reads the number from `awb` and requests its status.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

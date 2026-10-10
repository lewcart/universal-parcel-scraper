# Omniva

Omniva items use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Omniva's trackers in Estonia, Latvia and Lithuania show the numbers
Omniva issues in the UPU S10 layout, ending `EE`: parcels starting `CC`, `CE` or `CF`, and
letters and registered items such as `LL` and `RO`. Omniva's help pages give the `CE` layout
for the return code a business client registers in advance. These stay with the generic postal
carrier, as do the foreign UPU numbers the trackers also answer. The lookups also show Omniva's
own parcel IDs: `JJEE` and seventeen digits, or `JJEE`, three letters and eleven digits, which
`omniva-1` and `omniva-2` claim. The Lithuanian tracker also answered `ZA` and eight digits, a
layout Omniva does not document, so no rule claims it.

## Links

Omniva's self-service trackers open one parcel at `/track/{number}` on `minu.omniva.ee`,
`mana.omniva.lv` and `mano.omniva.lt`; archived lookups also used their former `minuold`,
`manaold` and `manoold` hosts. Older tracking pages on `omniva.ee` and `omniva.lt` took the
number as `barcode`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).

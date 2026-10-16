# Bookurier

Bookurier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Bookurier's own waybills are BOK followed by seven digits, seen in an archived lookup on its
tracker. Rule bookurier-1 claims them with high confidence: the tracker script assigns the BOK
prefix to Bookurier, and Australia Post's ten-character consignment rule only suggests the
shape.

Bookurier also books shipments with GLS Romania, DPD, Sameday and Cargus, and its tracker
accepts their numbers. Twelve-digit waybills from its tracker are kept as quarantined scope
evidence because their histories continue with GLS Romania scans. Sameday and DPD numbers are
left to those carriers.

## Links

The current tracker opens one parcel from its `awb` parameter, and the older trackifnew.php
page on bookurier.ro took the same parameter. Both are read as links.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

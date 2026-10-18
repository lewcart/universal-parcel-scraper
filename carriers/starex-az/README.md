# Starex

Starex parcels use enabled universal providers. There is no dedicated adapter.

Starex (Starex MMC) brings online purchases from Turkey, the United States and China to
Azerbaijan through its warehouses abroad, clears them through customs and hands them over at
its branches and pickup points or by courier. Its site also takes parcels for Uzbekistan.

## Numbers

An archived lookup on Starex's former parcel page carries `STR` and nine digits. That is
inside the three letters and nine digits that `purolator-2` claims, and one lookup is too
little to set the prefix apart, so no rule claims it.

## Links

The tracking box on `starexglobal.com` opens `/az/tracking/{number}` (also under `/en/` and
`/ru/`), which loads the history. The former site on `starex.az` read the number from
`?parcelNumber=` on `/baglama/`. The library reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

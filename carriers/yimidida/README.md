# Yimidida

Yimidida parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Waybills are twelve digits: the tracking pages check for exactly twelve digits. Bare
twelve-digit numbers are printed by many carriers, so no Yimidida rule is proposed.

## Links

The home page sends the numbers it is given to the goods-tracking menu page in `params`, so
`www.yimidida.com/demoModel?id=…&params={number}` opens one parcel. That page frames
`www.yimidida.com/usercenter/goods?params={number}`, which reads the same parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

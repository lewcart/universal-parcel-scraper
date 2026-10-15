# BlueEX

BlueEX parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

BlueEX consignment notes seen in archived lookups on its tracker are ten digits. The site's
script also accepts `CP` followed by twelve digits, a layout no public sample shows. Ten
digits are printed by many carriers and no known prefix or check digit sets BlueEX apart, so no
rule claims them; a caller names the carrier or pastes a tracking page link.

## Links

The search box on blue-ex.com opens one consignment at `/tracking` with the number in
`trackno`. Former addresses took it in `cn` on `/tracking.php` and in `trackno` on
`/index.php`. The library reads the number from all three.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

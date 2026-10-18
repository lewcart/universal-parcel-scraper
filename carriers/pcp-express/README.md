# PCP Express

PCP Express parcels use enabled universal providers. There is no dedicated adapter.

PCP Express, run by PT Yapindo Transportama, carries documents and parcels between its
branches across Indonesia and delivers them to the door.

## Numbers

The current AWB has twenty characters: the origin and destination branch codes, a service
letter and digit, the date, a letter and a five-digit counter, as an archived lookup on the
carrier's tracking page shows. Older AWBs on its e-SAPA tracking addresses have a branch code,
twelve digits and sometimes a four-digit piece counter. No rule claims either: one current
number is too little evidence, and the older layout is a branch code followed by a bare digit
run.

## Links

`pcpexpress.com/lacak_detailv2.php` opens one AWB from its `awb` parameter. The home page form
posts to a results page that lists several AWBs.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

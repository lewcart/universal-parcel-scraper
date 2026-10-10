# DAO

DAO parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

DAO's tracker says its parcel numbers are nine digits, thirteen digits starting `7`, or twenty
digits starting `00057`, and it also takes the nine-digit code of a labelless parcel. Lookups
archived from the tracker show only the twenty-digit numbers. They are SSCCs under Danish GS1
company prefixes, which name whoever issued them rather than the carrier, and the shorter
numbers are bare digit runs that many carriers print, so no rule claims any of them.

## Links

DAO's tracker at `dao.as/find-din-pakke/` puts the number in the address fragment, as
`#q={number}`, and reads it from there when the page opens. Older links from DAO's own site
carry it in the `q` or `stregkode` parameter of that page, of its English `track-your-parcel`
page, of the home page or of the `dao-app` page; the library reads all of them.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).

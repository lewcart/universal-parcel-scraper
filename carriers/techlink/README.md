# Techlink

Techlink parcels use enabled universal providers. There is no dedicated adapter yet.

Techlink is 智禾国际物流(深圳)有限公司 (智禾), a Shenzhen cross-border forwarder whose site is
techlinksz.cn, with special-line small-parcel services to Europe and the United States. Its
parcels reach the destination country's courier, which prints its own number; CJ Packet
ships some of its parcels on Techlink's line.

## Numbers

Its waybills are ZHPHD, the date as six digits, six more digits and ML. A sample on TrackShip's
Techlink page and parcels Techlink's tracker answered share the layout, and no other carrier's
rule takes it, so `techlink-1` has high confidence. CJ Packet's tracker finds such a parcel
too, under its own CJ Packet number, so CJ Packet's adapter does not take it.

## Links

The site's tracking page takes no number in its address, and the site is HTTP only, so neither
a link nor a search page is recorded.

## Adapter lead

The site's tracking page posts `{"order_nums": "<numbers, comma-separated>"}` to
`http://api.techlinksz.com/api/trackinfo/` with no cookie, token or key. The JSON reply has one
entry per number with its `order_num`, the scans in `track_list` and the latest in `new_track`.
Each scan has a code, Chinese and English wording, a location, both countries and the last-mile
number. The API answers over HTTP only.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

# 4PX

The public tracking site sends an anonymous JSON request to its tracking API.
The adapter selects the exact requested parcel and keeps its newest-first scan
order. Multi-package orders require separate parcel histories and fall back to
the providers.

Cainiao-style `LP` references ending in `CN` suggest 4PX without selecting it.
Emile's barcodes of `EM`, sixteen digits and `CA`, on parcels 4PX hands to Emile in Canada,
suggest 4PX ahead of [Emile](../emile/README.md): Emile's history names 4PX as the shipper,
and 4PX's feed holds the whole journey where Emile's holds the Canadian leg, so recognition
settles on 4PX when both know the number. Emile's twelve-digit barcodes stay Emile's.
HTTP recognition uses the same identity-bound feed to confirm matching shipment activity.

The portal displays each scan's `tkDateStr` with `tkTimezone`, an offset or,
for some partners' scans, a zone name. The adapter uses that pair because
`tkDate` carries different clock digits. A scan without a zone, or with a zone
name the clock database does not know, is retained as `local_time`, without an
invented instant.

Event codes map to stages. `FPX_O_IR` and `FPX_O_IRI` relay whatever step a
partner reported, from a label to an arrival abroad, so their wording decides.
A partner's transit scans relayed without a code are staged by their whole
wording. Other unknown codes stay unstaged.

The server reference can identify a delivery partner's tracking number. Shared
result normalization keeps only a USPS routing barcode's package number, never
the ZIP code before it.
The contact card names the last-mile provider and its website; the adapter
reports the catalog carrier both agree on, never the card's phone numbers, and
provider discovery confirms the operator separately. The feed also answers
partners' numbers and 4PX's `OLS` references, which detection does not route
here. It also follows the Cainiao Express `DOFR…HD` numbers of parcels 4PX hands to
Cainiao Express in France, from the first mile; Cainiao answers them only once Cainiao
Express has the parcel, without 4PX's leg. Aggregators name 4PX "4PX Express" for those, and
that name is an alias, so their naming leads to this adapter, which still has to find the parcel.

Run `npm run test:carriers:live -- carriers/four-px`.
Set `FOUR_PX_TRACKING_NUMBER` outside the repository to check a real parcel.

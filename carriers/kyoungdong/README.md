# Kyungdong Express

Kyungdong Express parcels use enabled universal providers. There is no dedicated adapter.

Kyungdong Express (경동택배), run by Kyungdong Logistics, carries parcels and bulky freight
across Korea through its branches.

## Numbers

Waybill numbers have thirteen digits. The tracking field asks for the digits alone, without
the hyphens a label can print. Questions on Naver KnowledgeiN and lookups archived from
Kyungdong's own tracker show them. No check digit is known, and Korea Post and other carriers
print thirteen-digit runs too, so no rule claims them.

## Links

`kdexp.com/service/delivery/etc/delivery.do?barcode={number}` opens one parcel. Kyungdong's
notice gives it and `service/delivery/ns/delivery.do` as the replacements for the old
`basicNewDelivery.kd` and `del_search.kd` addresses, which archived lookups use. All four take
the number as `barcode`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

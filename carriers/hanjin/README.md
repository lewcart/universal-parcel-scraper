# Hanjin

Hanjin parcels use enabled universal providers. There is no dedicated adapter.

Hanjin Transportation runs the South Korean parcel service 한진택배. Hanjin Shipping, the
container line, is a different company.

## Numbers

Hanjin's tracker takes twelve or fourteen digits. The waybills seen are twelve digits, and
archived lookups on the former tracker also carry ten-digit ones. In all of them the last digit
is the rest modulo 7, the check Yamato, Sagawa, Japan Post and other Korean carriers use too.
Bare digits with that check are printed by many carriers, so no rule claims them.

## Links

The tracking form posts its number, but the result page also answers a plain address, so
`www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblnum={number}&schLang=KR`
opens one parcel. The former tracker on `hanjin.co.kr` used
`/Delivery_html/inquiry/result_waybill.jsp` with the number in `wbl_num`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

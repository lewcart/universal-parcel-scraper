# HCT Logistics

HCT Logistics parcels use enabled universal providers. There is no dedicated adapter.

HCT Logistics (新竹物流) is a Taiwanese freight and parcel carrier.

## Numbers

The tracker asks for a ten-digit cargo or bill-of-lading number (10碼貨號/提單號). On every
sample the last digit is the remainder of the first nine divided by seven. DHL Express waybills
carry the same check, so no rule claims these numbers.

## Links

None. The tracker posts its form behind a picture code, and the older `SearchGoods.aspx`
address, which carried the number in Base64, now redirects to the home page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

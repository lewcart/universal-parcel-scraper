# SBS Sokuhai

SBS Sokuhai parcels use enabled universal providers. There is no dedicated adapter.

SBS Sokuhai Support (SBS即配サポート) is the SBS group's parcel delivery company in Japan. Its
tracker is hosted on saqura-web.com.

## Numbers

The お問い合わせ番号 has thirteen digits. In every archived lookup the last digit is the rest of
the first twelve modulo 7, and the numbers start with 04 or 05. Rule `sbs-sokuhai-1` claims
that shape with low confidence: other carriers print thirteen-digit numbers starting with 0,
and the check digit does not establish ownership.

## Links

`saqura-web.com/SBS_LTRC/KF_5020.aspx?IraNo={number}` opens one parcel; archived lookups also
use the `numberms` parameter there and `number01` on the `/SBS_LTRC/` list page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

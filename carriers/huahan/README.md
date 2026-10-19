# HuaHan Logistics

HuaHan Logistics parcels use enabled universal providers. There is no dedicated adapter: the
tracker's lookup answers only after a CAPTCHA, an arithmetic question asked before every search,
and HuaHan's tracking API needs a customer account.

HuaHan, a Shenzhen forwarder that trades as 华翰速递 (HuaHan Express), flies parcels from Shenzhen
through Hong Kong to Europe and hands them to a local carrier there.

## Numbers

HuaHan waybills are `HHW`, two letters, ten digits and `YQ`. HuaHan's API documentation uses
them in its examples and says they track on 17TRACK and on HuaHan's site. `huahan-1` claims the
layout; the three-letter prefix is HuaHan's own. For some services HuaHan's API also returns a
last-mile number, such as a China Post S10 number, which postal detection handles.

## Links

HuaHan's [tracker](https://www.hh-exp.cn/WebTrack/CargoTrack.html) posts the numbers to its own
service, which answers only after the CAPTCHA, so no address opens one parcel. The page and
HuaHan's home page point customers to 17TRACK for the same numbers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

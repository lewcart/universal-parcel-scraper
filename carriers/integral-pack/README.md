# Integral Pack

Integral Pack parcels use enabled universal providers. There is no dedicated adapter.

Integral Pack Express is an Argentine parcel carrier that ships through a network of
agencies.

## Numbers

An Integral Pack guide is the agency's four-digit point of sale, a letter and a number of up
to eight digits, the layout of an Argentine invoice number. The tracker
pads the parts and prefixes `IPE-`. The only public guide is the sample result on the former
tracking page. The same layout numbers other Argentine companies' receipts, so no rule claims
it.

## Links

The tracker reads the guide from `?codigo=` on `www.integralpack.com.ar/seguimiento` and
searches at once, so `www.integralpack.com.ar/seguimiento?codigo={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

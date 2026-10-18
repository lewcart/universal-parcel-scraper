# Evdemo Lojistik

Evdemo Lojistik parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Evdemo Lojistik is a Turkish delivery network for furniture and other bulky goods, run from
Kayseri through its own branches. Its tracking numbers have twelve digits: 1, the day and month
the parcel was registered, and a rising serial. Archived lookups on its tracker and customer
complaints show them.

No rule claims these numbers. Twelve-digit numbers are shared by many carriers, and the date
inside does not set Evdemo's apart. Marketplace order numbers that customers quote next to them
are not tracking numbers.

## Links

One parcel opens on www.evdemolojistik.com at `/takip` with the number in the `kargo_kodu`
parameter. The tracking form builds that address, and the library reads the number from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

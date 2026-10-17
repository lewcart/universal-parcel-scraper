# CityMail

CityMail parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

CityMail's tracker asks for the parcel reference from its SMS or email. Lookups archived from
its tracker show references of `BCM`, one to three letters and seven to nine digits; the
letters after `BCM` change with the sender, and the Spåra paket page's own example has the
same layout. `citymail-1` claims that family. Its twelve-character references also fit the
GoGo Xpress and Colis Privé twelve-character rules, which is declared.

Amazon parcels CityMail delivers keep Amazon's `AM` and nine-digit reference, a shape other
carriers' references share, so no rule claims it. Archived lookups of S10 numbers and of a
sequential `UN` series found nothing on CityMail's tracker, so they are not kept.

## Links

The tracker on `tracking.citymail.se` is a GET form that sends the reference as `search`, so
`tracking.citymail.se/?search={number}` opens one parcel; archived lookups use the same
address. The Spåra paket page on `citymail.se` posts the number to the site instead.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

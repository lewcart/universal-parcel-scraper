# Hovership

Hovership parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Hovership Delivery is a US delivery service for same-day, next-day, two-to-four-day and bulky
parcels, run with its own drivers and partner carriers. Its API documentation and an archived
lookup on its tracker show numbers made of HV and eight letters or digits. Shippers may also
set their own numbers of up to 30 letters, digits, underscores or dashes.

No rule claims Hovership numbers. The shape cannot name Hovership while shippers choose their
own numbers, and some generated numbers also fall inside C chez vous's low-confidence shape of
four letters, two digits and four letters or digits.

## Links

One parcel opens on www.hovership.com under `/track/` followed by the number. The tracking form
builds that address after upper-casing the number and removing spaces, and the library reads
the number from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

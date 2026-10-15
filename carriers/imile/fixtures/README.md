# Fixtures

`delivered.json` and `in-transit.json` follow the reply of `/saastms/mobileWeb/track/query` in
English, newest scan first. `delivered.json` goes from the order to the delivery through a
booked flight, clearance, two delivery runs and a driver's reason: one run is repeated, the
run scans carry the driver's phone, and the delivery names who took the parcel and links its
proof photos. `in-transit.json` waits at destination customs after a pickup and a flight, and
names a last-mile number. `not-found.json` is the answer for a number iMile does not know.

Numbers, names, phones, places and clocks are invented.

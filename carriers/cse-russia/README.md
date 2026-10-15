# CSE

CSE parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

CSE's tracker takes order and waybill numbers. Its own replies show order-based numbers written
as three digits, a hyphen and nine or ten digits, waybills of eight or thirteen digits, and
longer numbers in three hyphenated groups. Detection strips hyphens, so every layout becomes a
plain run of digits that many carriers share, and CSE has no rule. Marketplace and partner
references that the tracker also answers belong to the parties that issued them.

## Links

cse.ru opens a search at `/{city}/track/` with the number in the `numbers` parameter; the city
code changes with the visitor's region. The former `track.php` page took the number in its
`number` parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

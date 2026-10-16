# Vozovoz

Vozovoz parcels use enabled universal providers. There is no dedicated adapter.

Vozovoz (Возовоз) is a Russian groupage and freight carrier that also serves Belarus and
Kazakhstan.

## Numbers

Its tracker asks for the nine-digit number given when the order is placed. The numbers seen in
customer reviews start with the last two digits of the year. Nine-digit runs are printed by
many carriers, so no rule claims them.

## Links

The tracker reads the number from `id` on `vozovoz.ru/order/manage/` and writes it there after
a lookup, so that address opens one order. It is read as a link.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).

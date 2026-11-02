# Fixtures

Pages of TNT Australia's consignment history at `ASPs/trackref_detail.asp?con={number}`: the
number and, while one is due, the estimated delivery above a table of scans, oldest first.

- `delivered.html`: a consignment lodged, collected, processed, carded at a first attempt and
  brought back to the depot, then delivered, with a booking note before the second round and
  another after the delivery. The estimate stays on the page.
- `in-transit.html`: a consignment on its way, with a scan the page gives without a clock, a
  wording the status map does not know, a depot with an escaped character, a scan without a
  depot and an estimate whose day drops its leading zero.
- `not-found.html`: the answer for a number the tracker has no consignment for.

Numbers, depots and clocks are invented.

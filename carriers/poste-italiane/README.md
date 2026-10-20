# Poste Italiane

The Italian postal operator. Tracked through the keyless DoveQuando REST endpoint behind the
`poste.it/cerca` tracker. Dutch handoffs of Poste Italiane consignments stay with
[PostNL](../spring-gds/README.md). SDA parcel shapes are recognition candidates;
matching native Poste status or progress confirms them. Other postal shapes use the generic postal fallback.
Of the S10 numbers, the adapter takes only Poste Delivery Europe's (`CW…IT` with a valid check
digit), which Poste issues and its tracker follows from acceptance. It refuses the others, so
mail from abroad to Italy is not handed to Poste Italiane.

## How it works

1. `direct`: one `POST https://www.poste.it/online/dovequando/DQ-REST/ricercasemplice` with
   `{ codiceSpedizione, tipoRichiedente: "WEB", periodoRicerca: 1 }` and `poste.it`
   `Origin`/`Referer`. No cookies, token or account. The echoed `idTracciatura` must match.
   The envelope decides the outcome, not the HTTP status (unknown numbers answer 200):
   - `esitoRicerca` `1` or `2`: not-found.
   - No `esitoRicerca`, parcel type `P` and explicit empty `listaMovimenti`: an old expired parcel, also not-found.
     Unknown and expired look identical to an anonymous caller.
   - `esitoRicerca` `3` with no movements: the parcel exists but is unscanned, so
     `pending`/`registered`, not unknown.
   - `esitoRicerca` `3` for letter post (`tipoSpedizione` `C`) at `stato` `1`, with neither a
     product nor a movement list: a code Poste does not know, so not-found. A code whose check
     digit fails answers that way.
   - HTTP 404/410 means the tracking endpoint is unavailable. Other non-200 replies remain upstream errors.
   - Missing or unusable history is a schema failure. Unrecognized empty envelopes remain inconclusive.

## Notes

- SDA delivery services use [Poste's shipment search](https://business.cert.poste.it/business/files/1476520760931/poste-delivery-business-express-standard-scheda-prodotto.pdf).
  Its [official request builder](https://www.poste.it/cerca-app/js/module/forms-ricerche-directive.js)
  submits the complete code. Detection and adapter eligibility share the catalog rules;
  neither a matching shape nor an expired reply confirms issuance.
- Aggregators name SDA's parcels "SDA", "Italy SDA" or "SDA Express Courier". Those names are
  aliases, so a provider's naming points to Poste's tracker, which still has to know the number.
- Poste's own scans are instants. Its catalog clock is Rome's for the providers: Ship24 relays
  SDA's distribution-center scans as wall clocks without an offset, and they read on that clock
  as the same moments Poste's own copies give.
- Partners abroad hand Poste Italiane parcels under a DHL Parcel Connect plate, `JJD` and
  twenty-one digits, and link to Poste's tracker with it, as PPL does. The adapter takes those
  plates for that hand-off. DHL issues them, so no detection rule names Poste for them.
- Complaints against Poste Italiane quote `JF` and eleven digits for parcels sent through
  MyPoste and Poste Delivery Web, and Poste's tracker names them Promo Pacco.
- PROMOPACCO PLUS parcels carry `F`, three digits, `D` and eight digits. Poste's tracker
  follows them, but no public sample is known, so the shape only suggests Poste Italiane
  (`poste-italiane-promopacco`) and recognition asks it.
- Codes of `D`, five digits, a letter and six digits are Poste's too: its tracker follows
  them, for ROAD EUROPE shipments for instance. No public sample is known, so the shape only
  suggests Poste Italiane (`poste-italiane-d`) and recognition asks it.
- SDA's 13-character codes with a digit before the `C` start with `3`, as complaints quote
  them, with `1`, which Poste's tracker follows for Crono Express parcels, or with `9`, which it
  follows for CRONO PLUS parcels arriving from Cainiao. No public sample starts with `1` or `9`.
- Registered mail (Raccomandata, Raccomandata 1, A.R. and judicial documents) carries eleven
  digits and a check digit, printed after a dash or a space. Poste's
  [barcode specification](https://business.poste.it/business/files/1473808025319/raccomandatagiudiziaria-codice-a-barre.pdf)
  defines the check: eleven times the sum of the digits in even places, plus the sum of those
  in odd places, gives a number whose digit sum mod 10 is the last digit. Every public number
  passes it. The leading digits vary with the product and the sender, so the low-confidence
  rule `poste-italiane-registered` takes any twelve digits whose check holds. FedEx, BRT and
  other carriers take twelve digits too, so the shape only suggests Poste Italiane and
  recognition asks it.
- Envelope `stato` `5` forces `delivered` whatever the movement wording says: a delivered
  parcel sometimes carries a truncated last line. A parcel sent back ends with its delivery
  to the sender; that delivery carries the return flag (`flagRitorno`) and reads as
  `returned`. Without per-movement flags, the envelope flag and an earlier return scan
  decide.
- Stages come from Italian `statoLavorazione` wording. Both the typographic and the ASCII
  apostrophe are accepted (`e' stata consegnata` appears live). Unmapped wording gets no
  stage rather than a regex catch-all guess; the sync records it for review.
- Customs release wording maps to `in_transit`.
- A post-office scan names its office, which becomes the event location; the office's
  address, postcode and hours are not kept. Other scans keep `luogo` only when it is a town
  and province, such as `PESCARA (PE)`, or a delivery "dalla sede operativa di" that town.
  The location adds the country, `PESCARA (PE), IT`, because many provinces share a
  country's code and a final code reads as the country. Any other `luogo`, such as a post
  office's street address or a street named with its province, is dropped.
- `tipoProdotto` names the product, such as Poste Delivery Standard. Letter-post items echo
  their own number there, which is not kept.
- `dataPrevistaConsegna` is Italian prose ("Consegna prevista entro Venerdì 2 Gennaio 2026"),
  reduced to a calendar day and cleared once delivered. Unparsable text yields no estimate.
- `dataOra` is epoch milliseconds, so there is no zone to guess. A local helper renders it
  with milliseconds (`.000Z`) because those strings are persisted and `core/time`'s
  `epochMillisTime` would drop them.
- At most 20 events are returned, newest first. Movements come oldest first, so of two
  sharing an instant the later one is newer.
- Sender, recipient, address, signature, weight, dimensions and pickup office are never read;
  a test asserts it.
- Not used: scraping `poste.it/cerca`. It is a JavaScript app and its HTML carries no history.

## Limitations

- No event location for a scan at a post office's street address without its office name.
- Day-resolution estimate only.
- Poste's tracker also answers those codes with other digits before the `C`. No parcel shows
  one yet, so neither detection nor the adapter takes them.

## Testing

`npm run test:carriers:live -- carriers/poste-italiane`. The unknown-number
check needs no env vars; set `POSTE_ITALIANE_DELIVERED_TRACKING_NUMBER` to also check a real
delivered parcel, and `POSTE_ITALIANE_TRACKING_NUMBER` for a real parcel in any state.

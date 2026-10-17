# Poste Italiane fixtures

- `delivered.json`: full DoveQuando envelope for a delivered parcel (`esitoRicerca` `3`,
  `stato` `5`, an estimate line, four movements) plus the sender, recipient, address,
  signature, office and weight blocks the parser must drop. Every identifier, name and
  address is synthetic.
- `registered-mail.json`: a registered letter (`tipoSpedizione` `C`, `RACC. GENERICHE`) accepted
  at a post office, sorted, then held at another office for collection. Each movement carries
  the office blocks the parser must drop. Every identifier and office is synthetic.

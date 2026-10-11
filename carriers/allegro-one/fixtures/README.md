# Fixtures

`delivered.json`, `ready.json` and `returned.json` follow the shape of the edge service's reply:
`status`, a list of scans newest first, each with a UTC instant and an English wording. The clocks
and sequences are invented; `delivered.json` repeats one scan so the tests can check that identical
rows are dropped. An unknown number's reply is `{"status":[]}`.

# Places

Carriers say where a scan happened in free text: "Härkingen", "LEIPZIG - DE", "Sort centre
Chicago IL", "FRANCE". The Node-only `/places` entry point turns this text into coordinates,
or `null` when it cannot place the scan confidently.

```js
import { locatePlace, placesForEvents } from 'universal-parcel-scraper/places';

locatePlace('LEIPZIG - DE');
placesForEvents(['Härkingen', 'Zürich'], { carriers: ['swiss-post'] });
```

## How a place is chosen

- The text is split into fields and phrases, and facility words ("hub", "Paketzentrum",
  "sort centre") are dropped. What is left is matched against town names, and translations
  for larger towns ("Genf", "Cologne"). A translation of three Latin letters is left out: it
  is a code or a stray transliteration more often than a name ("Lon" for Lognes). Translations
  include old names, so nothing confirming it, only a city's of 100,000 people places a town
  (Trenton was "Mill Hill"). A town found by a translation keeps the carrier's words for its own
  name: "Asuncion del Paraguay" is "Asuncion". Each half of a bilingual name counts
  ("Biel/Bienne"), but not a direction that halves a district's ("Neustadt/Süd").
- A town is looked up at the start or the end of a name, and between other words when it is
  a city of 100,000 people where the parcel is ("Example Reading Station Lockers"), or
  something else in the text confirms it.
- A longer place name is the place it names, not a town that shares a word of it, when it
  is a town where the text or the parcel is, or a city and the shorter name names no town
  there: "Cartagena de Indias" is in Colombia, "San Jose de Costa Rica" in Costa Rica, but
  "East London MC" on a British parcel is in London. A town within 50 km of the longer name
  may still be the one meant ("NEW DELHI"). Elsewhere, a town nothing but a country confirms
  is no word of a longer name some town has, unless it is a city of 100,000 people where the
  text or the parcel is: "Mill Hill Post Office" is not in Hill.
- A country after the last dash is taken off, as DHL Express prints it ("BENIN CITY -
  NIGERIA", "AMSTERDAM - NETHERLANDS, THE"). Georgia stays: it is also a US state.
- Chinese, Japanese and Korean names match in their own script. "广东省深圳市" is read as
  a province followed by a city, and a county-level city after its prefecture's city, in
  the same province, is where the scan is: "浙江省金华市义乌市" is Yiwu. A town's name can
  start a facility's ("义乌转运中心"); a word for a facility or a part of town ("中心",
  "新城") names no town. Latin letters next to such script are a word: "Changsha市".
- Bigger towns win, and context breaks ties: a country written in the text, a state,
  province or canton, by code or by name ("STERLING - Virginia - USA", "CURITIBA - PR"), a
  Swiss postcode, then the countries of neighbouring scans, the parcel's destination and
  its carriers' countries. `placesForEvents` reads those from the catalog for the carrier
  ids in `carriers`: the countries a carrier delivers in, unless they are more than six, and
  the country of its clock. `carrierCountries` adds countries by code.
- Towns of one name in one country, more than 50 km apart and neither twice the other's size,
  are told apart by the scans around them: Royal Mail's "Kennington DO" between London's
  scans is in London, by Ashford in Kent. Alone, the scan gets no place.
- Context does not outweigh a city of a million people, or a town of 100,000 ten times the
  size of the namesake context picks, when it lies nearer the way between the scans around
  it: "Warsaw" between Lviv and New York is in Poland.
- A state, province or canton written after the town holds: "Earth City, MO" is not Earth
  in Texas.
- Two letters after the town are a country when a town of that name is there ("MONTE CARLO
  MC"), or when the parcel is. Otherwise they may be a province or an office: "PINEROLO
  (TO)" is in the province of Turin, not Tonga, and Royal Mail's "Norwich MC" is a mail
  centre, not Monaco. A depot's number in brackets can follow the code ("Vilvoorde - BE
  (depot 0001)"). The town's own province settles it, then a town of that name where the
  parcel is, then, for a code no comma or bracket sets apart, any town of that name. With no
  town at all, a code in brackets or after a space is no country on a parcel known to be
  elsewhere, and the scan gets no place.
- A US military post office ("Fpo, AE", "APO AP 96001") names a region of the US armed
  forces, not a country: AE there is not the Emirates, and the base can be anywhere in the
  region. The scan gets no place, and `trackingPlace` and `trackingLocationCountry` give it
  no country.
- A field that only names a region is that region: it places a town of that name only if
  the town lies in it, and otherwise places the region's country ("Guangdong Province").
  The words of a region's name are not towns elsewhere: "Cabo Delgado" is in Mozambique,
  not "Delgado" in El Salvador, nor is a region's name a small town of its country outside
  it ("Mid Wales MC" is not Wales in Yorkshire). A region the parcel's countries have wins over
  a namesake abroad. Carriers still print some regions' former names: "Distrito Federal" is
  Mexico City's on a Mexican parcel and Brasília's on a Brazilian one.
- A town nothing confirms needs 15,000 people. Otherwise the scan gets no place: a wrong
  dot is worse than none. Postcodes only confirm a name, never stand in for one.
- A town only its name places, in a country nothing else puts the parcel in, is a namesake
  when it is far from the other scans: more than 6,000 km off the way between the scans
  around it that hold ("Cornwall" in Ontario between two scans in England), or, where the
  scans stop, more than 3,000 km from them and from the parcel's countries. It gets no
  place, and tells the scans around it nothing. Where the scans stop, a name no other town
  has and a city of a million people stay: nothing says the parcel did not go there.
- India Post ends an office's name with its PIN code, and abbreviates some names past
  reading ("KOL AP TMO 700052"). Text that names no town, not even one nothing confirms, is
  placed in the PIN's town from `pincodes.json` when the scan or the parcel is in India. A
  foreign airport code ("Office - FRA …") names an office of exchange abroad: its PIN is the
  Indian office's, and places nothing.
- USPS places some scans only at a ZIP Code ("ZIP Code 60600"). Its first three digits name
  an area, placed from `zipcodes.json` in the town that holds most of the area's codes. An
  area many towns share places nothing.
- Text that names only a country gets that country, marked `country`, so the map shades
  the country instead of pinning a town. A DHL operation followed only by a country name
  also places that country; the carrier's name alone supplies no country. A country name
  followed only by facility words is a city of that name of 100,000 people or more, on a
  parcel in the city's country and not in the named one: GIG Logistics' "BENIN HUB" is in
  Benin City.

## Scans filed away from the parcel

An office can file a scan where the parcel is not. DHL Express updates the customs clearance
at the destination's office while the parcel is still being sorted at the origin, and a
delivering carrier registers a parcel in its own country before the parcel has left. Given each
scan's stage and time (`stages` and `times`), `placesForEvents` gives such a scan no place, so a
map does not send the parcel there and back. The scan keeps its text.

Only a scan of paperwork (`registered`, `pending` or `customs`) or one that names only a
country can be away. The scans that handle the parcel in a town say where it is, and the scan
is away when:

- it lies more than 300 km off the way between the handling scans before and after it,
  measured from a country's nearest town;
- the parcel would have had to fly faster than 1,000 km/h, give or take two hours, between it
  and the handling scan before or after it. Clocks without an offset prove nothing;
- the handling scans around it are in other countries, and the parcel only comes to its
  country later.

A country between two handling scans abroad can be the way through: a Hong Kong hub between
Shenzhen and Leipzig stays.

The gazetteer loads once per process, from the packaged asset. `preloadPlaces()` loads it
ahead of the first lookup. Results are cached in memory; consumers decide whether to
persist them or serve a parcel when place resolution fails.

## Clocks

`placeTimeZone` gives the zone a place keeps its clock on: its country's, or in a country of
several zones, its state's or province's (the US, Canada, Australia, Brazil) or the zone whose
principal place in the tz database's `zone.tab` lies nearest. A place that names only such a
country takes the zone most of its people live on. `airportTimeZone` reads an airport its code
names, alone ("AMS"), with an airport word ("JFK Airport") or with its country ("BNE, AU"): a
bare code the parcel's way does not bear out places nothing, but it tells a forwarder's clock.

`dateLocalClocks(carrier, result)` dates the scans a carrier gives on a wall clock in no stated
zone (`local_time`). The zone comes from the scan's place, read with the scans around it; else
from the nearest scan that has a place; else from the parcel's destination, when the carrier
delivers there; else from the carrier's home clock: its catalog zone, or with UTC there, its
first country's. The scan keeps `local_time` and gains `time`, `time_zone` and
`time_zone_basis` (`place`, `neighbour`, `destination` or `carrier`). Node lookups through
`trackCarrier()` and `createTracker()` apply it to a carrier's own answer. Scans dated by their
day alone keep it; `carrierHomeZone(carrier, result)` gives the home clock a host can start
such a day on.

A deduced zone can be wrong near a border between zones, or for a carrier that keeps one clock
everywhere. A zone the carrier states, or one learned by comparing its clocks with copies that
carry an instant, belongs in its adapter, which then dates the scan itself.

## Facilities

Some carriers say exactly where a scan happened, and the town's centre can be kilometres off:
Swiss Post's "Zürich Briefzentrum" is in Mülligen.

- `facilities.json` places sorting centres by the six-digit site number Swiss Post ends its
  scan text with ("Zürich Briefzentrum 801050"), whichever source relayed the scan. The text
  must also start with the site's town. The place keeps the town as its name; a distinct facility name is returned as `site`.
  Only sites seen in scans are listed, each with the
  OpenStreetMap element its point comes from. The first four digits are often not a
  postcode (8920 and 8520, the Urdorf and Frauenfeld parcel centres, are none), so unknown
  sites stay on their town.
- A scan that names an airport is placed at it, when the airport is within 60 km of the
  town: by its code in brackets ("Frankfurt Airport (FRA)"), by a word of its name that is
  neither the town nor the country ("LONDON-HEATHROW"), by the words of its name together
  ("Chicago O Hare"), or as the town's one airport when
  the text says airport ("LIEGE AIRPORT"). The place keeps the town as its name and returns
  the airport as `site`.
- A code with an airport word ("JFK Airport") or the airport's country or state ("BNE, AU")
  is that airport, whatever town elsewhere has its letters, unless a town of 100,000 people
  in that country has them ("POA, BR" is Poá).
- A bare code ("CDG") places nothing alone: three letters are too often something else.
  Among a parcel's scans it is the airport when the way bears it out: the airport is in a
  country of the parcel or of the scans around it, within 300 km of one of them, or no more
  than 3,000 km off the way between them, or between the scan before and the destination (a
  hub such as Doha between China and Europe). A town of 100,000 people keeps its letters
  ("POA" is Poá). Otherwise the code is no town nothing else confirms ("CAN" is no Çan in
  Turkey).
- A country's three-letter code alone ("ITA") is that country, when the parcel is there.
  Elsewhere it is no town nothing else confirms: "ITA" is not Itá in Paraguay.
- A UPU office of exchange ("DEFRAA": a country's two letters, an airport's code, an office
  letter) is in the town of the airport its code names, when the airport is in that
  country.
- A station named by an airport's code and a number, as iMile names its Italian ones ("BLQ
  01"), is in that airport's town, when the parcel is in the airport's country. Elsewhere the
  code places nothing.
- `hubs.json` lists hubs named after a place that is not their town ("ROISSY" is the
  Charles de Gaulle airport, not Roissy-en-Brie), with the town and airport they stand for,
  and hubs the gazetteer cannot place by name, with their point and its source: in a village
  too small for it ("SEKOCIN STARY", by Warsaw), in a district it leaves out (Royal Mail's
  "LANGLEY HWDC" by Heathrow, which would otherwise be Langley in Canada), in a town GeoNames gives no population
  (Cainiao's "Fenggang Town" is in Dongguan, not the Fenggang of Jiangxi), or under a short
  name ("TERRASSON", Mondial Relay's agency in Terrasson-Lavilledieu), in the wrong one of
  two towns ("Shatian Town" is Cainiao's warehouse in Dongguan), or named after an area
  (Royal Mail's "South Midlands MC" is in Northampton: `site` then holds the facility's
  name). A longer place name that contains a hub's ("Beauregard-de-Terrasson",
  "Roissy-en-Brie") is that place. A hub with `carriers` counts only on their parcels,
  ahead of the towns of its name, which still win when the text says which one: on a DPD
  parcel "Buchs, CH" is the depot in Buchs ZH, and "Buchs SG" the town in St. Gallen. SPX
  Brazil's "ShiYan", whose wording names Shenzhen, is in Shenzhen's Shiyan, not the city in Hubei.
  MRW's "Meres (Plataforma)" is its platform in Meres, Asturias, not the town in Turkey.
  Royal Mail's mail centres named after an area ("Thames Valley MC", in Swindon, not Valley
  on Anglesey) count on Royal Mail and Parcelforce parcels.
- A carrier's own coordinates, supplied through the `points` option, move a scan
  to the facility when they are within 30 km of the town its text names. Scans with the same
  text share a point, so a carrier that places some scans of an office keeps them together.

## Data

`node scripts/generate-places.mjs` builds `places.tsv.br`: GeoNames towns of 1,000 people
or more and first-level regions, the postal localities of Switzerland, Liechtenstein, their
neighbours and the Benelux, the Canadian municipalities postal areas are named after (Canada
Post still addresses Scarborough and North York, now part of Toronto), Swiss and
Liechtenstein postcodes, OurAirports airports with
scheduled service, and the Natural Earth country label points in `countries.json`.
Decisions about what to include are commented in the script.
`node scripts/generate-pincodes.mjs <directory.csv>` builds `pincodes.json` from the
[All India Pincode Directory](https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month)
CSV: each PIN goes to the GeoNames town of 50,000 people or more nearest its head office or
delivery offices, within 25 km, a tenfold population counting for 5 km. PINs with no such
town are left out.
`node scripts/generate-zipcodes.mjs` builds `zipcodes.json` from the GeoNames US postal
codes: a ZIP Code prefix goes to the town that holds most of its codes, three or more.
Then run `node scripts/generate-region-towns.mjs`: the carrier catalog keeps
the towns of a few US states and Canadian provinces from it. `npm run test:generated`
checks this projection.

GeoNames data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
([geonames.org](https://www.geonames.org)) and facility points come from
[OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL). Natural Earth and
[OurAirports](https://ourairports.com/data/) are public domain. The pincode directory is
published by the Department of Posts under the
[Government Open Data License - India](https://www.data.gov.in/Godl). Credits are included
in [NOTICE](../NOTICE).

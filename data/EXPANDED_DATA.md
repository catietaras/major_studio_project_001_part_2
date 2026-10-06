# Expanded NMAH George Washington data

The visitor-facing site still reads `washington-objects.json`. The expanded
catalog is built separately so unreviewed API matches cannot accidentally
appear in the experience.

Run:

```sh
node scripts/build-nmah-washington-catalog.js
```

The script recreates the broad historical search and writes three generated
files:

- `generated/nmah-washington-candidates.json`: every NMAH result.
- `generated/nmah-washington-on-view.json`: results whose current Smithsonian
  metadata reports that they are physically on exhibit.
- `generated/nmah-washington-map-ready.json`: on-view results whose exhibition
  can be joined to a verified museum floor.
- `generated/nmah-washington-review.csv`: the on-view results in a compact
  review sheet with suggested relationship, exhibition, floor, and space for
  reviewer notes.

Every result starts with `review.status` set to `unreviewed`. The suggested
relationship is only a triage aid. A record should not enter the child-facing
experience until its relationship to George Washington, image suitability,
display status, and location have been reviewed.

`nmah-exhibition-locations.json` is intentionally maintained separately from
the API output. Smithsonian object metadata identifies an exhibition; official
NMAH visitor resources identify that exhibition's floor. Exact room/case map
coordinates are not inferred.

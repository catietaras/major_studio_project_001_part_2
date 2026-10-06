# Reviewed on-view records

This directory contains the human-reviewed layer derived from the raw API
audit in `data/generated/`.

- `nmah-washington-on-view-reviewed.json` retains every on-view candidate and
  records an explicit approved/excluded decision with rationale.
- `nmah-washington-approved.json` contains only approved George Washington
  records, including objects whose floor is not yet resolved.
- `nmah-washington-map-ready-reviewed.json` contains approved records whose
  exhibition is joined to a verified floor.
- `nmah-washington-reviewed.csv` is the compact audit trail.

The many catalog records beginning with `Life of George Washington` are kept
as individual source records but share one group ID. A map or interface should
render that book series as one collection rather than dozens of separate map
markers.

The existing visitor-facing site still uses `data/washington-objects.json`.
These reviewed files are ready for the next integration step but do not replace
the live data automatically.

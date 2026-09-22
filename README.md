# Where Will George Washington Take You?

A playful National Museum of American History prototype for children about ages 5–8. A visitor picks one of three real Washington-related objects on the same floors as the museum’s public entrances, then finds four more objects by following Washington or a shared idea such as clothing, metal, or a time period. Each five-object path ends at the fifth object.

## Run locally

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The JSON files usually will not load from a `file://` URL.

## Experience

- The first screen starts with an object: a Washington banknote on floor 1, or the Washington statue or inaugural button on floor 2. There is no entrance chooser.
- The start and object screens focus on the object and its clues. The museum location is shown as a short floor and room label.
- Each object has a short story scene written for ages 5–8 and large picture-led choices. The original plain description, catalog title, date, photo source, and editorial note sit under **Grown-up facts**.
- One choice follows a fixed Washington trail. Other choices lead to real Washington-related objects that share a material, topic, or time period with something already visited. The choice card shows the next object and whether it has a museum room or is an online discovery.
- After five objects, the visitor sees a treasure map of only the floors and room areas they visited, with thin arrows showing visit order from stop 1 to stop 5. Online discoveries get their own row. This is a conceptual map, not walking directions or exact case locations.

## Data and sources

`data/washington-objects.json` contains 19 cataloged Washington-related objects. Seventeen have published on-view gallery areas; two are online discoveries with no confirmed room. The app uses locally saved photographs for all 19 and links each image source and Smithsonian object record. The identities and galleries are sourced from the linked Smithsonian pages, including the [museum map and visitor information](https://americanhistory.si.edu/visit/museum-map). Gallery display can change, so confirm current locations before visiting.

The 12 entries in `data/collection-objects.json` are illustrative research examples with SVG placeholders. They are kept as prototype data but are not offered as child-facing route choices. They need real catalog verification before use in the experience.

The `story` field, child-facing names, and concept links are editorial. The `description` field remains the earlier plain-language summary. Shared metadata values make a route structurally valid; they do not by themselves prove a historical relationship. Some Smithsonian images have “Usage Conditions Apply.” Local download for this prototype does not establish reuse or publication rights; review each image’s notice before public deployment.

## Files

- `index.html` — page shell
- `style.css` — responsive visual design, including the treasure map
- `script.js` — object choices and the journey treasure map
- `data/washington-objects.json` — cataloged Washington objects and curated metadata
- `data/collection-objects.json` — unused illustrative research examples
- `assets/` — object photos, old illustrative SVGs, and the official map asset retained for reference

## Adding objects

The browser reads local JSON. `scripts/fetch-smithsonian-data.js` can fetch a page of Smithsonian Open Access candidates with a locally supplied `SMITHSONIAN_API_KEY`; it never overwrites the reviewed files. Check an object’s identity, on-view room, photo rights, and accessible child-facing copy before adding it to the experience. Keep API keys out of browser code and committed files.

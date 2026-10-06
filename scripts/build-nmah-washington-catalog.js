#!/usr/bin/env node
// Build a reviewable NMAH George Washington catalog from the Smithsonian API.
//
// The output is deliberately split into layers:
//   candidates: every NMAH row returned by the broad historical query
//   on-view: candidates whose current API metadata says they are on exhibit
//   map-ready: on-view candidates whose exhibition has a verified floor
//
// No candidate becomes editorially approved automatically. The relationship
// suggestion is a review aid, not a published factual classification.

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const endpoint = 'https://api.si.edu/openaccess/api/v1.0/search';
const query = process.argv.slice(2).join(' ') || 'george washington';
const pageSize = 1000;

async function readApiKey() {
  const envText = await fs.readFile(path.join(root, '.env'), 'utf8');
  const match = envText.match(/^\s*(?:SMITHSONIAN_)?API_KEY\s*=\s*(['"]?)([^'"\r\n]+)\1\s*$/m);
  if (!match) throw new Error('Add API_KEY=... or SMITHSONIAN_API_KEY=... to .env.');
  return match[2].trim();
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  return [...new Set(values.flat().filter(Boolean).map(cleanText).filter(Boolean))];
}

function freetextEntries(content, field) {
  return content.freetext?.[field] || [];
}

function freetextValues(content, field) {
  return unique(freetextEntries(content, field).map(entry => entry.content));
}

function dataSources(row) {
  const content = row.content || {};
  return unique([
    row.unitCode === 'NMAH' ? 'National Museum of American History' : '',
    ...freetextValues(content, 'dataSource')
  ]);
}

function isNmah(row) {
  return row.unitCode === 'NMAH' || dataSources(row).includes('National Museum of American History');
}

function normalizeExhibitions(indexed) {
  return (indexed.exhibition || []).map(item => ({
    building: cleanText(item.building),
    title: cleanText(item.exhibitionTitle)
  })).filter(item => item.building || item.title);
}

function stableIds(row, descriptive) {
  const values = [row.url, descriptive.record_link, row.id].map(cleanText);
  for (const value of values) {
    const match = value.match(/(?:edanmdm:)?(nmah_[a-z0-9]+)/i);
    if (match) {
      return {
        smithsonianId: match[1].toLocaleLowerCase(),
        edanId: `edanmdm:${match[1].toLocaleLowerCase()}`
      };
    }
  }
  return { smithsonianId: cleanText(row.id), edanId: cleanText(row.id) };
}

function relationshipSuggestion(record) {
  const nameEvidence = record.relationships.names
    .map(entry => `${entry.label} ${entry.value}`)
    .join(' ');
  const descriptiveEvidence = [record.title, record.description].join(' ');
  const subjectEvidence = record.topics.join(' ');
  const exactName = /(?:george\s+washington|washington,\s*george)/i;

  if (exactName.test(nameEvidence)) return 'named-person-association';
  if (exactName.test(descriptiveEvidence)) return 'title-or-description-association';
  if (exactName.test(subjectEvidence)) return 'subject-association';
  return 'possible-incidental-match';
}

function normalize(row) {
  const content = row.content || {};
  const descriptive = content.descriptiveNonRepeating || {};
  const indexed = content.indexedStructured || {};
  const media = descriptive.online_media?.media || [];
  const image = media.find(item => item.type === 'Images' && (item.content || item.thumbnail));
  const noteEntries = freetextEntries(content, 'notes');
  const nameEntries = freetextEntries(content, 'name');
  const indexedNames = unique(indexed.name || []);
  const onPhysicalExhibit = unique(indexed.onPhysicalExhibit || []);
  const exhibitions = normalizeExhibitions(indexed);
  const ids = stableIds(row, descriptive);

  const record = {
    smithsonianId: ids.smithsonianId,
    edanId: ids.edanId,
    title: cleanText(descriptive.title?.content || row.title),
    date: freetextValues(content, 'date'),
    museum: 'National Museum of American History',
    objectType: unique([...(indexed.object_type || []), ...freetextValues(content, 'objectType')]),
    topics: unique([...(indexed.topic || []), ...freetextValues(content, 'topic')]),
    materials: unique(indexed.material || []),
    places: unique([...(indexed.place || []), ...freetextValues(content, 'place')]),
    description: cleanText(noteEntries[0]?.content),
    image: image?.content || image?.thumbnail || null,
    recordUrl: descriptive.record_link || row.url || null,
    relationships: {
      names: [
        ...nameEntries.map(entry => ({
          label: cleanText(entry.label),
          value: cleanText(entry.content)
        })),
        ...indexedNames.map(value => ({ label: 'indexed name', value }))
      ].filter((entry, index, entries) => entry.value && entries.findIndex(candidate =>
        candidate.label === entry.label && candidate.value === entry.value
      ) === index)
    },
    display: {
      onPhysicalExhibit,
      status: onPhysicalExhibit.some(value => /^yes$/i.test(value)) ? 'on-view' :
        onPhysicalExhibit.some(value => /^no$/i.test(value)) ? 'not-on-view' : 'unknown',
      exhibitions
    },
    review: {
      status: 'unreviewed',
      suggestedRelationship: null,
      relationship: null,
      notes: ''
    }
  };

  record.review.suggestedRelationship = relationshipSuggestion(record);
  return record;
}

function exhibitionIndex(config) {
  const index = new Map();
  for (const exhibition of config.exhibitions) {
    for (const alias of exhibition.aliases) {
      index.set(alias.toLocaleLowerCase(), exhibition);
    }
  }
  return index;
}

function addMapLocation(record, index, config) {
  const match = record.display.exhibitions
    .map(exhibition => index.get(exhibition.title.toLocaleLowerCase()))
    .find(Boolean);
  if (!match) return null;
  return {
    ...record,
    museumLocation: {
      floor: match.floor,
      wing: match.wing,
      exhibition: record.display.exhibitions.find(exhibition =>
        match.aliases.some(alias => alias.toLocaleLowerCase() === exhibition.title.toLocaleLowerCase())
      )?.title || match.aliases[0],
      exactMapPosition: null,
      verifiedAt: config.metadata.verifiedAt,
      evidence: config.metadata.sources,
      confidence: match.wing ? 'floor-and-wing-verified' : 'floor-verified'
    }
  };
}

async function apiPage(apiKey, start, rows) {
  const url = new URL(endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('start', String(start));
  url.searchParams.set('rows', String(rows));
  url.searchParams.set('sort', 'id');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Smithsonian API returned ${response.status} at row ${start}`);
  const json = await response.json();
  return json.response;
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function reviewCsv(records, locationByExhibition, locationConfig) {
  const headers = [
    'smithsonianId', 'title', 'suggestedRelationship', 'reviewStatus',
    'onView', 'exhibitions', 'floor', 'wing', 'recordUrl', 'reviewNotes'
  ];
  const rows = records.map(record => {
    const mapped = addMapLocation(record, locationByExhibition, locationConfig);
    return [
      record.smithsonianId,
      record.title,
      record.review.suggestedRelationship,
      record.review.status,
      record.display.status,
      record.display.exhibitions.map(item => item.title),
      mapped?.museumLocation.floor || '',
      mapped?.museumLocation.wing || '',
      record.recordUrl,
      ''
    ];
  });
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

async function main() {
  const apiKey = await readApiKey();
  const locationConfig = JSON.parse(await fs.readFile(path.join(root, 'data/nmah-exhibition-locations.json'), 'utf8'));
  const first = await apiPage(apiKey, 0, 0);
  const totalSmithsonianMatches = first.rowCount;
  const candidates = [];

  for (let start = 0; start < totalSmithsonianMatches; start += pageSize) {
    const response = await apiPage(apiKey, start, pageSize);
    for (const row of response.rows || []) {
      if (isNmah(row)) candidates.push(normalize(row));
    }
    console.log(`Fetched ${Math.min(start + pageSize, totalSmithsonianMatches)} / ${totalSmithsonianMatches}`);
  }

  candidates.sort((a, b) => a.smithsonianId.localeCompare(b.smithsonianId));
  const onView = candidates.filter(record => record.display.status === 'on-view');
  const locationByExhibition = exhibitionIndex(locationConfig);
  const mapReady = onView.map(record => addMapLocation(record, locationByExhibition, locationConfig)).filter(Boolean);
  const unmatchedOnViewExhibitions = unique(onView.flatMap(record => record.display.exhibitions.map(item => item.title)))
    .filter(title => !locationByExhibition.has(title.toLocaleLowerCase()));
  const fetchedAt = new Date().toISOString();
  const metadata = {
    query,
    fetchedAt,
    totalSmithsonianMatches,
    nmahCandidates: candidates.length,
    onViewCandidates: onView.length,
    mapReadyCandidates: mapReady.length,
    unmatchedOnViewExhibitions,
    warning: 'All records remain editorially unreviewed. Map-ready means display and floor metadata were found; it does not mean the George Washington relationship has been approved.'
  };
  const outputDir = path.join(root, 'data/generated');
  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(outputDir, 'nmah-washington-candidates.json'), { metadata, records: candidates }),
    writeJson(path.join(outputDir, 'nmah-washington-on-view.json'), { metadata, records: onView }),
    writeJson(path.join(outputDir, 'nmah-washington-map-ready.json'), { metadata, records: mapReady }),
    fs.writeFile(
      path.join(outputDir, 'nmah-washington-review.csv'),
      reviewCsv(onView, locationByExhibition, locationConfig)
    )
  ]);
  console.log(JSON.stringify(metadata, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

#!/usr/bin/env node
// Node 18+. Run locally with SMITHSONIAN_API_KEY; never ship the key to the browser.
const fs = require('node:fs/promises');
const path = require('node:path');

const apiKey = process.env.SMITHSONIAN_API_KEY;
if (!apiKey) {
  console.error('Set SMITHSONIAN_API_KEY before running this script.');
  process.exit(1);
}

const query = process.argv.slice(2).join(' ') || 'George Washington';
const endpoint = new URL('https://api.si.edu/openaccess/api/v1.0/search');
endpoint.searchParams.set('q', query);
endpoint.searchParams.set('rows', '50');
endpoint.searchParams.set('start', '0');
endpoint.searchParams.set('type', 'edanmdm');
endpoint.searchParams.set('api_key', apiKey);

function unique(values) {
  return [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
}
function fieldValues(content, names) {
  return unique(names.flatMap(name => (content.freetext?.[name] || []).map(entry => entry.content)));
}
function shortText(value, limit = 270) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}
function clean(row) {
  const content = row.content || {};
  const descriptive = content.descriptiveNonRepeating || {};
  const indexed = content.indexedStructured || {};
  const title = shortText(descriptive.title?.content || row.title, 180);
  const smithsonianId = row.id || null;
  const media = descriptive.online_media?.media || [];
  const image = media.find(item => item.thumbnail || item.content)?.thumbnail || null;
  const people = unique([...(indexed.name || []), ...fieldValues(content, ['name'])]);
  const description = fieldValues(content, ['notes','summary','description'])[0] || '';
  return {
    id: smithsonianId ? smithsonianId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() : null,
    smithsonianId,
    title,
    person: people,
    date: fieldValues(content, ['date'])[0] || '',
    museum: shortText(row.unitCode || content.freetext?.dataSource?.[0]?.content || '', 140),
    museumCode: row.unitCode || '',
    objectType: unique([...(indexed.object_type || []), ...fieldValues(content, ['objectType'])]),
    topics: unique([...(indexed.topic || []), ...fieldValues(content, ['topic'])]),
    materials: unique([...(indexed.material || []), ...fieldValues(content, ['physicalDescription'])]),
    places: unique([...(indexed.place || []), ...fieldValues(content, ['place'])]),
    people,
    image,
    recordUrl: descriptive.record_link || null,
    description: shortText(description),
    isWashingtonObject: false,
    dataStatus: 'smithsonian-api-unreviewed',
    connections: []
  };
}

async function main() {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Smithsonian API returned ${response.status}: ${response.statusText}`);
  const json = await response.json();
  const rows = json.response?.rows || [];
  const candidates = rows.map(clean).filter(item => item.id && item.title);
  const outputPath = path.join(__dirname, '..', 'data', 'api-candidates.json');
  await fs.writeFile(outputPath, JSON.stringify({ query, fetchedAt: new Date().toISOString(), count: candidates.length, records: candidates }, null, 2) + '\n');
  console.log(`Saved ${candidates.length} unreviewed records to ${outputPath}`);
  console.log('Review titles, images, rights, metadata, and conceptual links before adding records to the published JSON files.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

#!/usr/bin/env node
// Build the browser's object data from Smithsonian Open Access records plus
// the small child-facing/map layer in data/washington-editorial.json.
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');

async function readApiKey() {
  const envText = await fs.readFile(path.join(root, '.env'), 'utf8');
  const line = envText.split(/\r?\n/).find(entry => /^\s*(API_KEY|SMITHSONIAN_API_KEY)\s*=/.test(entry));
  if (!line) throw new Error('Add API_KEY=... to .env before building the data.');
  return line.split('=').slice(1).join('=').trim().replace(/^(['"])(.*)\1$/, '$2');
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(value => String(value).replace(/<[^>]+>/g, '').trim()).filter(Boolean))];
}

function fieldValues(content, field) {
  return unique((content.freetext?.[field] || []).map(entry => entry.content));
}

function firstField(content, field) {
  return fieldValues(content, field)[0] || '';
}

function descriptionFrom(content) {
  const notes = content.freetext?.notes || [];
  const preferred = notes.find(note => /description|summary/i.test(note.label || '')) || notes[0];
  return String(preferred?.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeApiRecord(row, editorial) {
  const content = row.content || {};
  const descriptive = content.descriptiveNonRepeating || {};
  const media = descriptive.online_media?.media || [];
  const imageRecord = media.find(item => item.type === 'Images' && item.content);
  const fallback = editorial.apiFallback || {};
  return {
    id: editorial.id,
    smithsonianId: editorial.smithsonianId,
    title: row.title || descriptive.title?.content || fallback.title || '',
    date: firstField(content, 'date') || fallback.date || '',
    museum: firstField(content, 'dataSource') || fallback.museum || row.unitCode || '',
    objectType: fieldValues(content, 'objectType').length ? fieldValues(content, 'objectType') : (fallback.objectType || []),
    topics: editorial.topics,
    materials: editorial.materials,
    periods: editorial.periods,
    image: editorial.image,
    recordUrl: row.url || descriptive.record_link || editorial.recordUrl || null,
    description: descriptionFrom(content) || fallback.description || '',
    gallery: editorial.gallery,
    imageSource: imageRecord?.content || editorial.imageSource || null,
    imageAlt: editorial.imageAlt,
    story: editorial.story
  };
}

async function fetchRecord(object, apiKey) {
  if (!object.smithsonianId) return normalizeApiRecord({}, object);
  const id = encodeURIComponent(`edanmdm:${object.smithsonianId}`);
  const endpoint = `https://api.si.edu/openaccess/api/v1.0/content/${id}?api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`${object.id}: Smithsonian API returned ${response.status}`);
  const json = await response.json();
  if (!json.response) throw new Error(`${object.id}: Smithsonian API returned no record`);
  return normalizeApiRecord(json.response, object);
}

async function main() {
  const apiKey = await readApiKey();
  const editorial = JSON.parse(await fs.readFile(path.join(root, 'data/washington-editorial.json'), 'utf8'));
  const records = [];
  for (const object of editorial) {
    records.push(await fetchRecord(object, apiKey));
    console.log(`${object.smithsonianId ? 'API' : 'CURATED'}  ${object.id}`);
  }
  const output = path.join(root, 'data/washington-objects.json');
  await fs.writeFile(output, JSON.stringify(records, null, 2) + '\n');
  console.log(`Saved ${records.length} objects to ${output}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

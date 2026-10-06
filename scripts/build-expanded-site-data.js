#!/usr/bin/env node
// Build the expanded object data that powers the original treasure-trail interface.
// Full Smithsonian records are fetched only to enrich images and descriptions.

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const placeholder = 'assets/object-placeholder.svg';

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
}

async function readApiKey() {
  const envText = await fs.readFile(path.join(root, '.env'), 'utf8');
  const match = envText.match(/^\s*(?:SMITHSONIAN_)?API_KEY\s*=\s*(['"]?)([^'"\r\n]+)\1\s*$/m);
  if (!match) throw new Error('Add API_KEY=... or SMITHSONIAN_API_KEY=... to .env.');
  return match[2].trim();
}

function clean(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.flat().filter(Boolean).map(clean).filter(Boolean))];
}

function fieldValues(content, field) {
  return unique((content.freetext?.[field] || []).map(entry => entry.content));
}

function descriptionFrom(content, fallback) {
  const notes = content.freetext?.notes || [];
  const preferred = notes.find(note => /description|summary/i.test(note.label || '')) || notes[0];
  return clean(preferred?.content || fallback);
}

function officialRecordUrl(id) {
  return `https://americanhistory.si.edu/collections/object/${encodeURIComponent(id)}`;
}

function periodsFromDate(value) {
  const years = String(value || '').match(/\b(1[6-9]|20)\d{2}\b/g) || [];
  return unique(years.map(year => {
    const number = Number(year);
    if (number < 1700) return '17th century';
    if (number < 1800) return '18th century';
    if (number < 1900) return '19th century';
    if (number < 2000) return '20th century';
    return '21st century';
  }));
}

async function fetchFullRecord(apiKey, record) {
  const url = `https://api.si.edu/openaccess/api/v1.0/content/${encodeURIComponent(`edanmdm:${record.smithsonianId}`)}?api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${record.smithsonianId}: API returned ${response.status}`);
  const json = await response.json();
  return json.response?.content || {};
}

async function concurrentMap(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function visitorObject(record, fullContent, location, legacy) {
  const descriptive = fullContent.descriptiveNonRepeating || {};
  const indexed = fullContent.indexedStructured || {};
  const media = descriptive.online_media?.media || [];
  const imageRecord = media.find(item => item.type === 'Images' && (item.content || item.thumbnail));
  const description = descriptionFrom(fullContent, record.description);
  const relationship = record.review.relationship;
  const displayTitle = legacy?.title || record.title;
  const date = fieldValues(fullContent, 'date').join('; ') || record.date.join('; ');
  return {
    id: legacy?.id || record.smithsonianId,
    smithsonianId: record.smithsonianId,
    title: record.title,
    displayTitle,
    date,
    periods: legacy?.periods || periodsFromDate(date),
    museum: 'National Museum of American History',
    objectType: unique([...(indexed.object_type || []), ...fieldValues(fullContent, 'objectType'), ...record.objectType]),
    topics: unique([...(indexed.topic || []), ...fieldValues(fullContent, 'topic'), ...record.topics]),
    materials: unique([...(indexed.material || []), ...record.materials]),
    image: legacy?.image || imageRecord?.content || imageRecord?.thumbnail || record.image || placeholder,
    imageAlt: legacy?.imageAlt || `Museum image for ${displayTitle}`,
    description: legacy?.description || description || 'The Smithsonian catalog connects this object to George Washington.',
    story: legacy?.story || description || 'Look closely at this object and consider how the Smithsonian connects it to George Washington.',
    recordUrl: officialRecordUrl(record.smithsonianId),
    relationship,
    relationshipConfidence: record.review.confidence,
    gallery: location ? {
      floor: location.floor,
      zone: location.wing,
      name: location.exhibition,
      verifiedAt: location.verifiedAt,
      confidence: location.confidence
    } : null,
    sourceRecordCount: 1,
    group: null
  };
}

function bookGroup(records) {
  const representative = records.find(record => record.image) || records[0];
  return {
    id: 'life-of-george-washington-book-series',
    smithsonianId: null,
    title: 'Life of George Washington Book Series',
    displayTitle: 'A Library of Washington Stories',
    date: '',
    periods: [],
    museum: 'National Museum of American History',
    objectType: ['Book series'],
    topics: ['George Washington', 'Books', 'Biography'],
    materials: ['paper'],
    image: representative?.image || placeholder,
    imageAlt: 'Books in the Life of George Washington series',
    description: `${records.length} catalog records make up this displayed series of books connected to the Life of George Washington.`,
    story: `This is not just one book. The museum catalog lists ${records.length} volumes in this Washington book collection.`,
    recordUrl: representative ? officialRecordUrl(representative.smithsonianId) : null,
    relationship: 'biography-or-publication',
    relationshipConfidence: 'high',
    gallery: null,
    sourceRecordCount: records.length,
    group: {
      id: 'life-of-george-washington-book-series',
      label: 'Life of George Washington book series',
      memberIds: records.map(record => record.smithsonianId)
    }
  };
}

async function main() {
  const [approvedFile, mapReadyFile, legacyObjects] = await Promise.all([
    readJson('data/reviewed/nmah-washington-approved.json'),
    readJson('data/reviewed/nmah-washington-map-ready-reviewed.json'),
    readJson('data/washington-objects.json')
  ]);
  const apiKey = await readApiKey();
  const approved = approvedFile.records;
  const groupMembers = approved.filter(record => record.group?.id === 'life-of-george-washington-book-series');
  const individualRecords = approved.filter(record => !record.group);
  const legacyBySmithsonianId = new Map(legacyObjects.filter(record => record.smithsonianId).map(record => [record.smithsonianId, record]));
  const locationById = new Map(mapReadyFile.records.map(record => [record.smithsonianId, record.museumLocation]));

  const objects = await concurrentMap(individualRecords, 5, async (record, index) => {
    const fullContent = await fetchFullRecord(apiKey, record);
    console.log(`Enriched ${index + 1} / ${individualRecords.length}: ${record.smithsonianId}`);
    return visitorObject(record, fullContent, locationById.get(record.smithsonianId), legacyBySmithsonianId.get(record.smithsonianId));
  });
  objects.push(bookGroup(groupMembers));
  objects.sort((a, b) => {
    const floorA = a.gallery?.floor ?? 99;
    const floorB = b.gallery?.floor ?? 99;
    return floorA - floorB || String(a.gallery?.name || '').localeCompare(String(b.gallery?.name || '')) || a.displayTitle.localeCompare(b.displayTitle);
  });

  const counts = {
    totalEntries: objects.length,
    individualObjects: individualRecords.length,
    groupedCollections: 1,
    sourceRecords: approved.length,
    withVerifiedFloor: objects.filter(object => object.gallery?.floor).length,
    withoutVerifiedFloor: objects.filter(object => !object.gallery?.floor).length,
    byFloor: Object.fromEntries([1, 2, 3].map(floor => [floor, objects.filter(object => object.gallery?.floor === floor).length])),
    byRelationship: Object.fromEntries([...new Set(objects.map(object => object.relationship))].sort().map(relationship => [
      relationship,
      objects.filter(object => object.relationship === relationship).length
    ]))
  };
  const output = {
    metadata: {
      builtAt: new Date().toISOString(),
      reviewedAt: approvedFile.metadata.reviewedAt,
      sourceFetchedAt: approvedFile.metadata.sourceFetchedAt,
      counts,
      note: 'The original five-stop treasure-trail interface uses this reviewed collection to generate many possible object routes.'
    },
    objects
  };
  await fs.writeFile(path.join(root, 'data/washington-expanded.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(counts, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

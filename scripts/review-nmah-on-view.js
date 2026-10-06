#!/usr/bin/env node
// Apply the documented human review of the current on-view candidate set.
// Raw API outputs in data/generated are never modified by this script.

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const reviewedAt = '2026-10-06';

const excluded = new Map(Object.entries({
  nmah_1004509: 'No documented George Washington connection; the search match is incidental.',
  nmah_1191397: 'Indiana Jones prop with no documented George Washington connection.',
  nmah_1198070: 'Washington, D.C. place-name match, not George Washington.',
  nmah_1282718: 'George W. Bush object, not George Washington.',
  nmah_1301370: 'Civil War object with no documented George Washington connection.',
  nmah_1313348: 'Unrelated owner named George and a Washington, D.C. reference.',
  nmah_1322675: 'George W. Bush/Washington, D.C. protest object, not George Washington.',
  nmah_1396361: 'Unrelated inventor named George.',
  nmah_1408302: 'George W. Bush state china, not George Washington.',
  nmah_1408303: 'George W. Bush state china, not George Washington.',
  nmah_1408313: 'George W. Bush state china, not George Washington.',
  nmah_1408348: 'George W. Bush state china, not George Washington.',
  nmah_1408364: 'George W. Bush state china, not George Washington.',
  nmah_1409799: 'No documented George Washington connection.',
  nmah_1409800: 'Unrelated inventor named George.',
  nmah_1803655: 'George Washington appears only in general classroom context, not on this object.',
  nmah_2001466: 'Tenino, Washington place-name match, not George Washington.',
  nmah_2002923: 'Tenino, Washington place-name match, not George Washington.',
  nmah_2015768: 'George Floyd/Washington, D.C. context, not George Washington.',
  nmah_412912: 'Same-gallery historical object with no documented George Washington connection.',
  nmah_414369: 'Connected to George Washington Morgan, not George Washington.',
  nmah_438624: 'Revolutionary-era context only; no object-level Washington connection.',
  nmah_438723: 'Benjamin Lincoln object with no object-level Washington connection.',
  nmah_441079: 'Adam Stephen object with no object-level Washington connection.',
  nmah_441101: 'Benjamin Tallmadge object with no object-level Washington connection.',
  nmah_445642: 'Andrew Jackson object with no object-level Washington connection.',
  nmah_445645: 'George McClellan object, not George Washington.',
  nmah_465667: 'World War I object with no documented George Washington connection.',
  nmah_490927: 'Dolley Madison object with no object-level George Washington connection.',
  nmah_693815: 'Washington is mentioned only in background history; the figure does not depict him.',
  nmah_703304: 'Unrelated inventor and electric-motor model.',
  nmah_727041: 'Civil War surgical object with no documented George Washington connection.',
  nmah_761853: 'Washington, D.C. protest context, not George Washington.',
  nmah_767573: 'George W. Bush event, not George Washington.',
  nmah_833907: 'George W. Bush event, not George Washington.',
  nmah_833910: 'George W. Bush event, not George Washington.',
  nmah_834472: 'Washington, D.C. protest context, not George Washington.',
  nmah_834810: 'Washington, D.C. protest context, not George Washington.',
  nmah_834996: 'George W. Bush inauguration, not George Washington.',
  nmah_844292: 'No documented George Washington connection.',
  nmah_846068: 'Unrelated owner named George in Washington, D.C.',
  nmah_846119: 'Unrelated inventor named George.',
  nmah_882217: 'No documented George Washington connection.',
  nmah_985725: 'Tenino, Washington place-name match, not George Washington.'
}));

const relationshipOverrides = new Map(Object.entries({
  nmah_1197004: 'namesake-or-commemoration',
  nmah_1199630: 'depicts-or-commemorates',
  nmah_1253315: 'biography-or-publication',
  nmah_1422329: 'depicts-or-commemorates',
  nmah_1764149: 'depicts-or-commemorates',
  nmah_1821294: 'biography-or-publication',
  nmah_1839987: 'depicts-or-commemorates',
  nmah_214479: 'depicts-or-commemorates',
  nmah_214480: 'family-or-household',
  nmah_498228: 'depicts-or-commemorates',
  nmah_501114: 'depicts-or-commemorates',
  nmah_501115: 'depicts-or-commemorates',
  nmah_509770: 'depicts-or-commemorates',
  nmah_515860: 'depicts-or-commemorates',
  nmah_515884: 'depicts-or-commemorates',
  nmah_529752: 'depicts-or-commemorates',
  nmah_571404: 'depicts-or-commemorates',
  nmah_572512: 'depicts-or-commemorates',
  nmah_572521: 'depicts-or-commemorates',
  nmah_688853: 'depicts-or-commemorates',
  nmah_740396: 'depicts-or-commemorates',
  nmah_746133: 'owned-or-used',
  nmah_747313: 'owned-or-used',
  nmah_834346: 'depicts-or-commemorates',
  nmah_962558: 'depicts-or-commemorates'
}));

function isBookSeries(record) {
  return /^nmah_305/i.test(record.smithsonianId) && /life of george washington/i.test(record.title);
}

function relationshipFor(record) {
  if (relationshipOverrides.has(record.smithsonianId)) return relationshipOverrides.get(record.smithsonianId);
  if (isBookSeries(record)) return 'biography-or-publication';
  const text = `${record.title} ${record.description}`;
  if (/martha washington|formal dinner service|wine glass|fruit dish|finger bowl|tumbler|brocade gown/i.test(text)) {
    return 'family-or-household';
  }
  if (/worn by|used by|washington's|owner and user|camp cup|dispatch case|constitutional convention box/i.test(text)) {
    return 'owned-or-used';
  }
  if (/portrait|bust|paperweight|button|pin|pitcher|bank note|resignation|pageant/i.test(text)) {
    return 'depicts-or-commemorates';
  }
  return 'documented-nmah-association';
}

function review(record) {
  const exclusionReason = excluded.get(record.smithsonianId);
  if (exclusionReason) {
    return {
      ...record,
      review: {
        status: 'excluded',
        includeInWashingtonCatalog: false,
        relationship: null,
        confidence: 'high',
        reviewedAt,
        rationale: exclusionReason
      }
    };
  }

  const relationship = relationshipFor(record);
  return {
    ...record,
    review: {
      status: 'approved',
      includeInWashingtonCatalog: true,
      relationship,
      confidence: relationship === 'documented-nmah-association' ? 'medium' : 'high',
      reviewedAt,
      rationale: isBookSeries(record)
        ? 'A cataloged volume in the Life of George Washington series; retain as one grouped series for mapping.'
        : relationship === 'documented-nmah-association'
          ? 'Official NMAH related-name metadata associates this object with George Washington, but the catalog record lacks a clarifying narrative.'
          : 'The title, description, depicted subject, namesake, or NMAH related-name metadata documents a George Washington connection.'
    },
    group: isBookSeries(record) ? {
      id: 'life-of-george-washington-book-series',
      label: 'Life of George Washington book series',
      mapAsSingleGroup: true
    } : null
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

async function main() {
  const generatedDir = path.join(root, 'data/generated');
  const outputDir = path.join(root, 'data/reviewed');
  const onViewSource = JSON.parse(await fs.readFile(path.join(generatedDir, 'nmah-washington-on-view.json'), 'utf8'));
  const mapReadySource = JSON.parse(await fs.readFile(path.join(generatedDir, 'nmah-washington-map-ready.json'), 'utf8'));
  const reviewed = onViewSource.records.map(review);
  const approved = reviewed.filter(record => record.review.status === 'approved');
  const rejected = reviewed.filter(record => record.review.status === 'excluded');
  const approvedIds = new Set(approved.map(record => record.smithsonianId));
  const reviewedById = new Map(reviewed.map(record => [record.smithsonianId, record]));
  const mapReady = mapReadySource.records
    .filter(record => approvedIds.has(record.smithsonianId))
    .map(record => ({
      ...record,
      review: reviewedById.get(record.smithsonianId).review,
      group: reviewedById.get(record.smithsonianId).group
    }));

  const floorCounts = Object.fromEntries([1, 2, 3].map(floor => [
    floor,
    mapReady.filter(record => record.museumLocation.floor === floor).length
  ]));
  const metadata = {
    reviewedAt,
    sourceFetchedAt: onViewSource.metadata.fetchedAt,
    totalReviewed: reviewed.length,
    approved: approved.length,
    excluded: rejected.length,
    approvedWithVerifiedFloor: mapReady.length,
    approvedFloorCounts: floorCounts,
    groupedSeries: [{
      id: 'life-of-george-washington-book-series',
      recordCount: approved.filter(isBookSeries).length,
      mapAsSingleGroup: true,
      floorStatus: 'unresolved'
    }],
    method: 'Manual metadata review of every API record marked onPhysicalExhibit, using titles, descriptions, related names, and full-record checks for ambiguous titles.',
    warning: 'On-view status and gallery assignments can change. Refresh the API audit before publication or an in-museum deployment.'
  };

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(outputDir, 'nmah-washington-on-view-reviewed.json'), { metadata, records: reviewed }),
    writeJson(path.join(outputDir, 'nmah-washington-approved.json'), { metadata, records: approved }),
    writeJson(path.join(outputDir, 'nmah-washington-map-ready-reviewed.json'), { metadata, records: mapReady })
  ]);

  const csvHeaders = ['decision', 'smithsonianId', 'title', 'relationship', 'exhibitions', 'floor', 'group', 'rationale', 'recordUrl'];
  const mapById = new Map(mapReady.map(record => [record.smithsonianId, record.museumLocation]));
  const csvRows = reviewed.map(record => [
    record.review.status,
    record.smithsonianId,
    record.title,
    record.review.relationship,
    record.display.exhibitions.map(item => item.title).join('; '),
    mapById.get(record.smithsonianId)?.floor || '',
    record.group?.label || '',
    record.review.rationale,
    record.recordUrl
  ]);
  await fs.writeFile(
    path.join(outputDir, 'nmah-washington-reviewed.csv'),
    [csvHeaders, ...csvRows].map(row => row.map(csvCell).join(',')).join('\n') + '\n'
  );

  console.log(JSON.stringify(metadata, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

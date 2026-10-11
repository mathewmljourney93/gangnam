'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processReviews,
  processJsonText,
  normaliseClinicName
} = require('../processing.js');
const { EXAMPLE_INPUT } = require('../example-data.js');

const CLINICS = [
  { id: 'c1', name: 'Haneul Demo Clinic', aliases: ['하늘데모의원', '강남 하늘 데모 의원'] },
  { id: 'c2', name: 'Byeol Sample Dermatology', aliases: ['별샘플피부과'] }
];

function review(overrides) {
  return Object.assign(
    { source: 's', sourceReviewId: 'r1', clinicName: 'Haneul Demo Clinic', text: '좋았어요.' },
    overrides
  );
}

function codes(record) {
  return record.flags.map((f) => f.code);
}

test('alias variants resolve to one canonical clinic', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [
      review({ sourceReviewId: 'r1', clinicName: '강남하늘데모의원', text: 'a' }),
      review({ sourceReviewId: 'r2', clinicName: '  HANEUL demo clinic ', text: 'b' }),
      review({ sourceReviewId: 'r3', clinicName: '하늘데모의원', text: 'c' })
    ]
  });
  assert.equal(out.ok, true);
  for (const r of out.records) {
    assert.equal(r.clinic.status, 'matched');
    assert.equal(r.clinic.canonicalId, 'c1');
    assert.deepEqual(r.flags, []);
  }
});

test('unknown and near-miss clinics stay unresolved rather than guessed', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [
      review({ sourceReviewId: 'r1', clinicName: '달 플레이스홀더 클리닉' }),
      review({ sourceReviewId: 'r2', clinicName: 'Haneul Demo' }) // not in this alias map
    ]
  });
  assert.equal(out.summary.unresolvedClinics, 2);
  for (const r of out.records) {
    assert.equal(r.clinic.status, 'unresolved');
    assert.equal(r.clinic.canonicalId, null);
    assert.deepEqual(codes(r), ['UNRESOLVED_CLINIC']);
    assert.match(r.flags[0].reason, /No match was guessed/);
  }
});

test('repeated source + review ID is flagged on every copy and all copies kept', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [review({ sourceReviewId: 'X' }), review({ sourceReviewId: 'Y', text: 'other' }), review({ sourceReviewId: 'X' })]
  });
  assert.equal(out.records.length, 3);
  assert.deepEqual(codes(out.records[0]), ['REPEATED_SOURCE_RECORD']);
  assert.deepEqual(out.records[0].flags[0].relatedIndexes, [2]);
  assert.deepEqual(out.records[2].flags[0].relatedIndexes, [0]);
  assert.deepEqual(codes(out.records[1]), []);
  // Same key is reported as a repeat, not additionally as a text duplicate.
  assert.ok(!codes(out.records[0]).includes('POSSIBLE_DUPLICATE_TEXT'));
  assert.equal(out.summary.duplicateCandidates, 2);
});

test('same review ID at different sources is not a repeat', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [review({ source: 'a', text: 'one' }), review({ source: 'b', text: 'two' })]
  });
  assert.equal(out.summary.duplicateCandidates, 0);
});

test('identical normalised text under different IDs at same clinic is a candidate, not merged', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [
      review({ sourceReviewId: 'r1', clinicName: '하늘데모의원', text: '상담이 친절했어요.' }),
      review({ source: 'other', sourceReviewId: 'r9', text: '  상담이   친절했어요!! ' })
    ]
  });
  assert.equal(out.records.length, 2);
  for (const r of out.records) {
    assert.deepEqual(codes(r), ['POSSIBLE_DUPLICATE_TEXT']);
    assert.match(r.flags[0].reason, /not proof of duplication/);
  }
  assert.deepEqual(out.records[0].flags[0].relatedIndexes, [1]);
  // Original text is preserved exactly as supplied.
  assert.equal(out.records[1].original.text, '  상담이   친절했어요!! ');
});

test('same text at different clinics is not flagged', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [
      review({ sourceReviewId: 'r1', clinicName: 'Haneul Demo Clinic', text: '좋았어요.' }),
      review({ sourceReviewId: 'r2', clinicName: '별샘플피부과', text: '좋았어요.' })
    ]
  });
  for (const r of out.records) assert.deepEqual(r.flags, []);
});

test('similar but distinct reviews are preserved without flags', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [
      review({ sourceReviewId: 'r1', text: '시설이 깨끗하고 설명이 자세했습니다.' }),
      review({ sourceReviewId: 'r2', text: '시설이 깨끗하고 설명이 친절했습니다.' })
    ]
  });
  assert.equal(out.summary.processed, 2);
  assert.equal(out.summary.duplicateCandidates, 0);
  assert.notEqual(out.records[0].original.text, out.records[1].original.text);
});

test('missing optional fields are allowed; translation is marked missing or unverified', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [review({ sourceReviewId: 'r1' }), review({ sourceReviewId: 'r2', text: 'x', translationEn: 'X' })]
  });
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.records[0].translation, { text: null, status: 'missing' });
  assert.deepEqual(out.records[1].translation, { text: 'X', status: 'supplied-unverified' });
});

test('invalid input produces clear errors', () => {
  assert.match(processJsonText('{not json').errors[0], /not valid JSON/);
  assert.equal(processReviews([]).ok, false);
  assert.match(processReviews({ clinics: CLINICS }).errors[0], /"reviews" must be an array/);
  assert.match(processReviews({ reviews: [] }).errors[0], /"clinics" must be an array/);

  const conflict = processReviews({
    clinics: [{ id: 'a', name: 'A', aliases: ['Same'] }, { id: 'b', name: 'B', aliases: ['same'] }],
    reviews: []
  });
  assert.equal(conflict.ok, false);
  assert.match(conflict.errors[0], /conflicts with clinic "a"/);

  const out = processReviews({
    clinics: CLINICS,
    reviews: [review({ sourceReviewId: '' }), { source: 's' }, 'text', review({ sourceReviewId: 'ok' })]
  });
  assert.equal(out.ok, true);
  assert.equal(out.summary.invalid, 3);
  assert.equal(out.summary.processed, 1);
  assert.ok(out.errors.includes('reviews[0].sourceReviewId is required and must be a non-empty string.'));
  assert.ok(out.errors.includes('reviews[1].clinicName is required and must be a non-empty string.'));
  assert.ok(out.errors.includes('reviews[2] must be an object.'));
  assert.deepEqual(codes(out.records[1]), ['INVALID_RECORD']);
});

test('processing does not mutate input and output is deterministic', () => {
  const before = JSON.stringify(EXAMPLE_INPUT);
  const a = JSON.stringify(processReviews(EXAMPLE_INPUT));
  const b = JSON.stringify(processReviews(JSON.parse(before)));
  assert.equal(a, b);
  assert.equal(JSON.stringify(EXAMPLE_INPUT), before);
});

test('example dataset produces the expected flags', () => {
  const out = processReviews(EXAMPLE_INPUT);
  assert.deepEqual(out.summary, {
    total: 8, processed: 8, invalid: 0, unresolvedClinics: 1, duplicateCandidates: 3
  });
  const byIndex = out.records.map(codes);
  assert.deepEqual(byIndex, [
    ['REPEATED_SOURCE_RECORD', 'POSSIBLE_DUPLICATE_TEXT'], // A-1001
    [],                                                     // B-2001
    ['REPEATED_SOURCE_RECORD', 'POSSIBLE_DUPLICATE_TEXT'], // A-1001 repeat
    ['POSSIBLE_DUPLICATE_TEXT'],                            // B-2002 same text, punctuation differs
    [],                                                     // similar but distinct
    ['UNRESOLVED_CLINIC'],                                  // unknown clinic
    [],                                                     // missing optional fields
    []                                                      // same text, different clinic
  ]);
  assert.equal(out.records[6].translation.status, 'missing');
});

test('regression: separator inside source or ID does not create a false repeat', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [
      review({ source: 'a::b', sourceReviewId: 'c', text: 'one' }),
      review({ source: 'a', sourceReviewId: 'b::c', text: 'two' })
    ]
  });
  assert.notEqual(out.records[0].recordKey, out.records[1].recordKey);
  assert.equal(out.summary.duplicateCandidates, 0);
});

test('regression: duplicate clinic IDs and empty-key aliases are rejected', () => {
  const dupId = processReviews({
    clinics: [{ id: 'c1', name: 'Alpha', aliases: [] }, { id: 'c1', name: 'Beta', aliases: [] }],
    reviews: []
  });
  assert.equal(dupId.ok, false);
  assert.match(dupId.errors[0], /used by more than one clinic/);

  const emptyAlias = processReviews({
    clinics: [{ id: 'c1', name: 'Alpha', aliases: ['---'] }],
    reviews: [review({ clinicName: '...' })]
  });
  assert.equal(emptyAlias.ok, false);
  assert.match(emptyAlias.errors[0], /no letters or digits/);
});

test('regression: symbol-only texts are not flagged as duplicate text', () => {
  const out = processReviews({
    clinics: CLINICS,
    reviews: [review({ sourceReviewId: 'r1', text: '👍' }), review({ sourceReviewId: 'r2', text: '❤️' })]
  });
  for (const r of out.records) assert.deepEqual(r.flags, []);
});

test('clinic normalisation is conservative', () => {
  assert.equal(normaliseClinicName(' Byeol Sample Derm. '), 'byeolsamplederm');
  assert.notEqual(normaliseClinicName('Byeol Sample Derm'), normaliseClinicName('Byeol Sample Dermatology'));
});

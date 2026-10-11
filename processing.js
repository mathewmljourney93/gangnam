/*
 * Review intake processing for the Gangnam Beauty Guide prototype.
 * Pure, deterministic functions. Works as a browser global (ReviewProcessing)
 * and as a CommonJS module for `node --test`.
 */
(function (root) {
  'use strict';

  var REQUIRED_REVIEW_FIELDS = ['source', 'sourceReviewId', 'clinicName', 'text'];

  var DISCLAIMERS = [
    'Records are preserved as supplied; nothing is merged or deleted.',
    'Duplicate flags are candidates for human review, not proof of duplication.',
    'Translations are as supplied and have not been verified.',
    'No procedure, surgeon or clinical outcome is verified from review text.'
  ];

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  // Conservative clinic-name key: Unicode NFKC, lower case, and removal of
  // whitespace and punctuation only. No suffix stripping or fuzzy matching.
  function normaliseClinicName(name) {
    return String(name)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, '');
  }

  // Text key for exact-match duplicate candidates: NFKC, lower case,
  // punctuation and symbols removed, whitespace collapsed.
  function normaliseReviewText(text) {
    return String(text)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildAliasIndex(clinics) {
    var errors = [];
    var index = new Map();
    var seenIds = new Set();
    if (!Array.isArray(clinics)) {
      return { index: index, errors: ['"clinics" must be an array of { id, name, aliases }.'] };
    }
    clinics.forEach(function (clinic, i) {
      var where = 'clinics[' + i + ']';
      if (!clinic || typeof clinic !== 'object' || Array.isArray(clinic)) {
        errors.push(where + ' must be an object.');
        return;
      }
      if (!isNonEmptyString(clinic.id)) errors.push(where + '.id must be a non-empty string.');
      if (!isNonEmptyString(clinic.name)) errors.push(where + '.name must be a non-empty string.');
      if (clinic.aliases !== undefined && !Array.isArray(clinic.aliases)) {
        errors.push(where + '.aliases must be an array of strings if supplied.');
      }
      if (!isNonEmptyString(clinic.id) || !isNonEmptyString(clinic.name)) return;
      if (seenIds.has(clinic.id)) {
        errors.push(where + '.id "' + clinic.id + '" is used by more than one clinic.');
        return;
      }
      seenIds.add(clinic.id);
      var names = [clinic.name].concat(Array.isArray(clinic.aliases) ? clinic.aliases : []);
      names.forEach(function (alias, j) {
        if (!isNonEmptyString(alias)) {
          errors.push(where + '.aliases[' + (j - 1) + '] must be a non-empty string.');
          return;
        }
        var key = normaliseClinicName(alias);
        if (!key) {
          errors.push('Alias "' + alias + '" in ' + where + ' has no letters or digits after normalisation.');
          return;
        }
        var existing = index.get(key);
        if (existing && existing.id !== clinic.id) {
          errors.push('Alias "' + alias + '" in ' + where + ' conflicts with clinic "' + existing.id + '".');
          return;
        }
        index.set(key, { id: clinic.id, name: clinic.name });
      });
    });
    return { index: index, errors: errors };
  }

  function validateReview(review, i) {
    var where = 'reviews[' + i + ']';
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
      return [where + ' must be an object.'];
    }
    var errors = [];
    REQUIRED_REVIEW_FIELDS.forEach(function (field) {
      if (!isNonEmptyString(review[field])) {
        errors.push(where + '.' + field + ' is required and must be a non-empty string.');
      }
    });
    if (review.translationEn !== undefined && review.translationEn !== null && typeof review.translationEn !== 'string') {
      errors.push(where + '.translationEn must be a string if supplied.');
    }
    return errors;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function others(indexes, self) {
    return indexes.filter(function (n) { return n !== self; });
  }

  /*
   * processReviews(input) -> { ok, errors, summary, records, disclaimers }
   * input: { clinics: [{ id, name, aliases[] }], reviews: [{ source, sourceReviewId,
   *          clinicName, text, language?, translationEn?, rating?, date? }] }
   * Structural errors (bad top level, bad alias map) return ok:false and no records.
   * Invalid individual reviews are kept, flagged INVALID_RECORD and excluded from matching.
   */
  function processReviews(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return fail(['Input must be a JSON object with "clinics" and "reviews" arrays.']);
    }
    if (!Array.isArray(input.reviews)) {
      return fail(['"reviews" must be an array.']);
    }
    var aliases = buildAliasIndex(input.clinics);
    if (aliases.errors.length) return fail(aliases.errors);

    var errors = [];
    var records = input.reviews.map(function (review, i) {
      var validationErrors = validateReview(review, i);
      errors = errors.concat(validationErrors);
      var record = {
        inputIndex: i,
        recordKey: null,
        original: clone(review),
        clinic: { status: 'invalid', canonicalId: null, canonicalName: null, normalisedInput: null },
        translation: { text: null, status: 'missing' },
        flags: []
      };
      if (validationErrors.length) {
        record.flags.push({
          code: 'INVALID_RECORD',
          reason: 'Not processed: ' + validationErrors.join(' '),
          relatedIndexes: []
        });
        return record;
      }
      // JSON array encoding so a separator inside source or ID cannot collide.
      record.recordKey = JSON.stringify([review.source.trim(), review.sourceReviewId.trim()]);
      var key = normaliseClinicName(review.clinicName);
      var match = aliases.index.get(key);
      record.clinic.normalisedInput = key;
      if (match) {
        record.clinic.status = 'matched';
        record.clinic.canonicalId = match.id;
        record.clinic.canonicalName = match.name;
      } else {
        record.clinic.status = 'unresolved';
        record.flags.push({
          code: 'UNRESOLVED_CLINIC',
          reason: 'Clinic name "' + review.clinicName + '" (key "' + key + '") is not in the alias map. No match was guessed.',
          relatedIndexes: []
        });
      }
      if (isNonEmptyString(review.translationEn)) {
        record.translation = { text: review.translationEn, status: 'supplied-unverified' };
      }
      return record;
    });

    var valid = records.filter(function (r) { return r.recordKey !== null; });

    // Repeated source + review ID.
    groupBy(valid, function (r) { return r.recordKey; }).forEach(function (group) {
      if (group.length < 2) return;
      var indexes = group.map(function (r) { return r.inputIndex; });
      group.forEach(function (r) {
        var related = others(indexes, r.inputIndex);
        r.flags.push({
          code: 'REPEATED_SOURCE_RECORD',
          reason: 'Source "' + r.original.source + '" review ID "' + r.original.sourceReviewId +
            '" also appears at input index ' + related.join(', ') + '. All copies are kept.',
          relatedIndexes: related
        });
      });
    });

    // Identical normalised text at the same canonical clinic under different record keys.
    // Text that normalises to nothing (only symbols/emoji) is not compared.
    var matched = valid.filter(function (r) {
      return r.clinic.status === 'matched' && normaliseReviewText(r.original.text) !== '';
    });
    groupBy(matched, function (r) {
      return r.clinic.canonicalId + '\u0000' + normaliseReviewText(r.original.text);
    }).forEach(function (group) {
      group.forEach(function (r) {
        var related = group
          .filter(function (o) { return o.recordKey !== r.recordKey; })
          .map(function (o) { return o.inputIndex; });
        if (!related.length) return;
        r.flags.push({
          code: 'POSSIBLE_DUPLICATE_TEXT',
          reason: 'Normalised text matches input index ' + related.join(', ') + ' at clinic "' +
            r.clinic.canonicalName + '" under a different source/review ID. Identical wording is not proof of duplication; not merged.',
          relatedIndexes: related
        });
      });
    });

    var duplicateCandidates = records.filter(function (r) {
      return r.flags.some(function (f) {
        return f.code === 'REPEATED_SOURCE_RECORD' || f.code === 'POSSIBLE_DUPLICATE_TEXT';
      });
    }).length;

    return {
      ok: true,
      errors: errors,
      summary: {
        total: records.length,
        processed: valid.length,
        invalid: records.length - valid.length,
        unresolvedClinics: records.filter(function (r) { return r.clinic.status === 'unresolved'; }).length,
        duplicateCandidates: duplicateCandidates
      },
      records: records,
      disclaimers: DISCLAIMERS.slice()
    };
  }

  function groupBy(items, keyFn) {
    var groups = new Map();
    items.forEach(function (item) {
      var key = keyFn(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return groups;
  }

  function fail(errors) {
    return { ok: false, errors: errors, summary: null, records: [], disclaimers: DISCLAIMERS.slice() };
  }

  // Parse JSON text with a readable error instead of an exception.
  function processJsonText(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return fail(['Input is not valid JSON: ' + e.message]);
    }
    return processReviews(parsed);
  }

  var api = {
    normaliseClinicName: normaliseClinicName,
    normaliseReviewText: normaliseReviewText,
    processReviews: processReviews,
    processJsonText: processJsonText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ReviewProcessing = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

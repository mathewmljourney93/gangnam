(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var lastResult = null;

  // All user content is inserted with textContent, never innerHTML.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function showErrors(errors) {
    var box = $('errors');
    box.replaceChildren();
    if (!errors.length) { box.hidden = true; return; }
    box.appendChild(el('strong', null, errors.length + ' input problem' + (errors.length > 1 ? 's' : '') + ':'));
    var list = el('ul');
    errors.forEach(function (msg) { list.appendChild(el('li', null, msg)); });
    box.appendChild(list);
    box.hidden = false;
  }

  function field(label, value, className) {
    var row = el('div', 'field ' + (className || ''));
    row.appendChild(el('span', 'label', label));
    row.appendChild(el('span', 'value', value));
    return row;
  }

  function renderRecord(record) {
    var li = el('li', 'card' + (record.flags.length ? ' flagged' : ''));
    var o = record.original || {};
    var head = el('div', 'card-head');
    head.appendChild(el('span', 'idx', '#' + record.inputIndex));
    head.appendChild(el('span', 'key', record.recordKey || 'invalid record'));
    var clinic = record.clinic;
    var status = clinic.status === 'matched'
      ? clinic.canonicalName + ' (' + clinic.canonicalId + ')'
      : clinic.status === 'unresolved' ? 'Unresolved' : 'Not processed';
    head.appendChild(el('span', 'pill ' + clinic.status, status));
    li.appendChild(head);

    if (typeof o === 'object' && o !== null) {
      li.appendChild(field('Clinic as supplied', o.clinicName != null ? o.clinicName : '—'));
      li.appendChild(field('Original text' + (o.language ? ' (' + o.language + ')' : ''), o.text != null ? o.text : '—', 'original'));
    } else {
      li.appendChild(field('Original value', JSON.stringify(o)));
    }
    li.appendChild(field(
      'English (supplied, unverified)',
      record.translation.status === 'missing' ? 'No translation supplied' : record.translation.text,
      record.translation.status === 'missing' ? 'muted' : ''
    ));

    if (record.flags.length) {
      var flags = el('ul', 'flags');
      record.flags.forEach(function (f) {
        var item = el('li');
        item.appendChild(el('code', null, f.code));
        item.appendChild(document.createTextNode(' ' + f.reason));
        flags.appendChild(item);
      });
      li.appendChild(flags);
    }
    return li;
  }

  function render(result) {
    showErrors(result.errors);
    var s = result.summary;
    $('stat-processed').textContent = s ? s.processed + (s.invalid ? ' / ' + s.total : '') : '–';
    $('stat-unresolved').textContent = s ? s.unresolvedClinics : '–';
    $('stat-duplicates').textContent = s ? s.duplicateCandidates : '–';
    var disc = $('disclaimers');
    disc.replaceChildren();
    if (result.ok) result.disclaimers.forEach(function (d) { disc.appendChild(el('li', null, d)); });
    var list = $('results');
    list.replaceChildren();
    result.records.forEach(function (r) { list.appendChild(renderRecord(r)); });
    $('download').disabled = !result.ok;
  }

  // Any change to the input makes the shown results and export stale.
  function invalidate() {
    lastResult = null;
    render({ ok: false, errors: [], summary: null, records: [] });
  }

  $('input').addEventListener('input', invalidate);

  $('load-example').addEventListener('click', function () {
    $('input').value = JSON.stringify(window.EXAMPLE_INPUT, null, 2);
    invalidate();
  });

  $('process').addEventListener('click', function () {
    var text = $('input').value;
    if (!text.trim()) {
      lastResult = null;
      render({ ok: false, errors: ['Input is empty. Paste JSON or click "Load example".'], summary: null, records: [] });
      return;
    }
    lastResult = window.ReviewProcessing.processJsonText(text);
    render(lastResult);
  });

  $('download').addEventListener('click', function () {
    if (!lastResult || !lastResult.ok) return;
    var blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'review-intake-output.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();

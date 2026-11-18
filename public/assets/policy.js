/* The deposit policy pop-up (v1.11.0), shared by Book Now (site.js) and the pay-later page (/book-now/pay/).

   Lorna's wording (Site Settings > Booking terms) in a real dialog: role="dialog", aria-modal, labelled by its
   heading. Focus moves in, stays in, and goes back to the button that opened it. The text scrolls inside the
   pop-up on small phones, with the tick box and buttons always in view. "I Agree & Continue" only works once the box
   is ticked; pressing it early explains why. The X, Escape and "Go back" close it without agreeing.

   APEPolicy.open({ text, consentLabel, version, opener, onAgree(agreedAtIso), onClose() }) */
(function () {
  'use strict';
  if (window.APEPolicy) return;

  var TEXT = {
    fallbackHeading: 'Deposit policy',
    agree: 'I Agree & Continue',
    back: 'Go back',
    close: 'Close and go back',
    needTick: 'Please tick the box to agree to the deposit policy before continuing.'
  };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function typeset(s) {
    return String(s).replace(/(\w)'(\w)/g, '$1’$2').replace(/(^|[\s(\[])'/g, '$1‘').replace(/'/g, '’')
      .replace(/(^|[\s(\[])"/g, '$1“').replace(/"/g, '”');
  }
  function t(s) { return esc(typeset(s)); }

  /* "## " headings, "- " bullets, blank lines between paragraphs. The first heading becomes the dialog's title. */
  function parse(text) {
    var blocks = [], para = [], list = [];
    function flushP() { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } }
    function flushL() { if (list.length) { blocks.push({ type: 'ul', items: list }); list = []; } }
    String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) { flushP(); flushL(); return; }
      if (line.indexOf('## ') === 0) { flushP(); flushL(); blocks.push({ type: 'h', text: line.slice(3) }); return; }
      if (/^[-*] /.test(line)) { flushP(); list.push(line.slice(2)); return; }
      flushL(); para.push(line);
    });
    flushP(); flushL();
    return blocks;
  }
  function html(blocks) {
    return blocks.map(function (b) {
      if (b.type === 'h') return '<h3>' + t(b.text) + '</h3>';
      if (b.type === 'ul') return '<ul>' + b.items.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>';
      return '<p>' + t(b.text) + '</p>';
    }).join('');
  }

  var openNow = null;

  function open(o) {
    if (openNow) return openNow;
    var blocks = parse(o.text);
    var title = TEXT.fallbackHeading;
    if (blocks.length && blocks[0].type === 'h') { title = blocks[0].text; blocks = blocks.slice(1); }
    var opener = o.opener || document.activeElement;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var wrap = document.createElement('div');
    wrap.className = 'policy-overlay' + (reduce ? ' no-motion' : '');
    wrap.setAttribute('data-ape-policy', '');
    wrap.innerHTML =
      '<div class="policy-dialog" role="dialog" aria-modal="true" aria-labelledby="ape-policy-h" aria-describedby="ape-policy-body">' +
        '<div class="policy-head"><h2 id="ape-policy-h">' + t(title) + '</h2>' +
          '<button type="button" class="policy-x" data-policy-back aria-label="' + esc(TEXT.close) + '"><span aria-hidden="true">×</span></button></div>' +
        '<div class="policy-body" id="ape-policy-body" tabindex="0">' + html(blocks) + '</div>' +
        '<div class="policy-foot">' +
          '<label class="check policy-tick"><input type="checkbox" id="ape-policy-tick" aria-describedby="ape-policy-err"><span>' + t(o.consentLabel) + '</span></label>' +
          '<p class="err policy-err" id="ape-policy-err" hidden><span class="err-mark" aria-hidden="true">!</span> <span>' + esc(TEXT.needTick) + '</span></p>' +
          '<div class="policy-actions"><button type="button" class="btn btn-ghost" data-policy-back>' + esc(TEXT.back) + '</button>' +
          '<button type="button" class="btn" data-policy-agree aria-disabled="true">' + esc(TEXT.agree) + '</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    var dialog = wrap.querySelector('.policy-dialog');
    var tick = wrap.querySelector('#ape-policy-tick');
    var agree = wrap.querySelector('[data-policy-agree]');
    var err = wrap.querySelector('#ape-policy-err');
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    var agreedAt = null;

    function focusables() {
      return [].slice.call(dialog.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    }
    function done(agreed) {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      wrap.remove();
      openNow = null;
      if (agreed) { if (o.onAgree) o.onAgree(agreedAt || new Date().toISOString()); }
      else {
        if (opener && opener.focus) opener.focus();
        if (o.onClose) o.onClose();
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); done(false); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!dialog.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    tick.addEventListener('change', function () {
      agreedAt = tick.checked ? new Date().toISOString() : null;
      agree.setAttribute('aria-disabled', tick.checked ? 'false' : 'true');
      if (tick.checked) { err.hidden = true; tick.removeAttribute('aria-invalid'); }
    });
    agree.addEventListener('click', function () {
      if (!tick.checked) {
        err.hidden = false;
        tick.setAttribute('aria-invalid', 'true');
        tick.focus();
        return;
      }
      done(true);
    });
    [].forEach.call(wrap.querySelectorAll('[data-policy-back]'), function (b) { b.addEventListener('click', function () { done(false); }); });
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) e.preventDefault(); });

    // focus the heading area first so screen readers read the title, then the body is next in the tab order
    dialog.setAttribute('tabindex', '-1');
    dialog.focus({ preventScroll: true });
    openNow = { close: function () { done(false); } };
    return openNow;
  }

  window.APEPolicy = { open: open, parse: parse, html: html, TEXT: TEXT };
})();

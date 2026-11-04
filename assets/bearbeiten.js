/* =============================================================
   INTEGRI bearbeiten.js: Texte direkt auf der Seite ändern
   Lädt nur mit ?bearbeiten=1 (Lader-Zeile in der Seite).
   Speichern und Veröffentlichen gehen nur lokal am Mac über den
   Bearbeiten-Server (127.0.0.1:8765). Live auf tools.integri.de
   zeigt die Leiste nur einen Hinweis.
   ============================================================= */
(function () {
  'use strict';

  var LOKAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  var WAEHLER = 'h1, h2, h3, p, li, .s-kicker, .s-aktion span, .s-btn, .s-unterzeilen > div, .s-schritte b';
  var KOPF = { 'X-Bearbeiten': '1', 'Content-Type': 'application/json' };

  var css = [
    '.bb-leiste{position:fixed;right:16px;bottom:16px;z-index:9999;width:300px;max-width:calc(100vw - 32px);background:#fff;color:#2C3E50;',
    'border-top:4px solid #033132;border-radius:8px;box-shadow:0 6px 20px rgba(3,49,50,.15);padding:16px;',
    'font:15px/1.45 "IBM Plex Sans",-apple-system,Arial,sans-serif}',
    '.bb-leiste b{display:block;color:#033132;font-size:16px;margin-bottom:6px}',
    '.bb-leiste button{font:inherit;font-weight:600;border-radius:4px;padding:7px 12px;cursor:pointer;margin:6px 6px 0 0;',
    'border:1px solid #033132;background:#fff;color:#033132}',
    '.bb-leiste button.bb-haupt{background:#F08972;border-color:#F08972;color:#fff}',
    '.bb-leiste button:disabled{opacity:.4;cursor:default}',
    '.bb-status{margin-top:8px;font-size:14px;color:rgba(44,62,80,.65)}',
    '.bb-tipp{font-size:13px;color:rgba(44,62,80,.65);margin-top:8px}',
    '[data-bb]{cursor:text;outline-offset:3px}',
    '[data-bb]:hover{outline:1px dashed rgba(240,137,114,.9)}',
    '[data-bb]:focus{outline:2px solid #F08972}',
    '[data-bb].bb-geaendert{box-shadow:inset 3px 0 0 #2D7D3E}',
    '.bb-zeigen [data-bb]{outline:1px dashed #F08972}'
  ].join('');

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  }

  // Bereinigt den Inhalt eines bearbeiteten Elements: nur Text, <br>, <b>/<strong> und vorhandene Links bleiben.
  function sauber(node) {
    var html = node.innerHTML
      .replace(/&nbsp;/g, ' ')
      .replace(/<div><br><\/div>/gi, '<br>')
      .replace(/<div>/gi, '<br>').replace(/<\/div>/gi, '')
      .replace(/<\/?span[^>]*>/gi, '')
      .replace(/<br[^>]*>/gi, '<br>')
      .replace(/(<br>)+$/i, '')
      .replace(/ {2,}/g, ' ')
      .trim();
    return html;
  }

  function start() {
    var style = el('style'); style.textContent = css; document.head.appendChild(style);
    var leiste = el('div', { 'class': 'bb-leiste' });
    leiste.appendChild(el('b', {}, 'Texte bearbeiten'));
    var status = el('div', { 'class': 'bb-status' });
    document.body.appendChild(leiste);

    if (!LOKAL) {
      status.textContent = 'Bearbeiten geht nur lokal am Mac: Bearbeiten-Server starten und http://127.0.0.1:8765' +
        location.pathname + '?bearbeiten=1 öffnen.';
      leiste.appendChild(status);
      return;
    }

    var wrapper = document.querySelector('.wrapper');
    fetch(location.pathname, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (quelle) {
      var doc = new DOMParser().parseFromString(quelle, 'text/html');
      var qListe = Array.prototype.slice.call(doc.querySelectorAll('.wrapper ' + WAEHLER.split(', ').join(', .wrapper ')));
      var sListe = Array.prototype.slice.call(wrapper.querySelectorAll(WAEHLER)).filter(function (n) {
        return !n.closest('.global-header, .global-footer, .bb-leiste');
      });
      // verschachtelte Treffer (z. B. p in li) nur einmal: das äußere Element bleibt
      function aussen(liste) { return liste.filter(function (n) { return !liste.some(function (m) { return m !== n && m.contains(n); }); }); }
      qListe = aussen(qListe); sListe = aussen(sListe);
      if (qListe.length !== sListe.length) {
        status.textContent = 'Die Seite passt nicht zu ihrer Datei (' + sListe.length + ' gegen ' + qListe.length +
          ' Texte). Bitte im Chat ändern.';
        leiste.appendChild(status);
        return;
      }

      var texte = [], gesperrt = 0;
      sListe.forEach(function (n, i) {
        var alt = qListe[i].innerHTML.trim();
        var treffer = alt ? quelle.split(alt).length - 1 : 0;
        if (treffer !== 1) { gesperrt++; return; }
        var t = { node: n, alt: alt, jetzt: alt };
        texte.push(t);
        n.setAttribute('data-bb', '');
        n.setAttribute('contenteditable', 'true');
        n.setAttribute('spellcheck', 'true');
        n.addEventListener('click', function (ev) { if (n.closest('a') && !ev.altKey) ev.preventDefault(); });
        n.addEventListener('paste', function (ev) {
          ev.preventDefault();
          var txt = (ev.clipboardData || window.clipboardData).getData('text/plain');
          document.execCommand('insertText', false, txt.replace(/\s*\n\s*/g, ' '));
        });
        n.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape') { n.innerHTML = t.jetzt; n.blur(); }
          else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); n.blur(); }
          else if (ev.key === 'Enter' && ev.shiftKey) { ev.preventDefault(); document.execCommand('insertLineBreak'); }
        });
        n.addEventListener('blur', function () {
          t.jetzt = sauber(n);
          n.classList.toggle('bb-geaendert', t.jetzt !== t.alt);
          zaehle();
        });
      });

      var bZeigen = el('button', {}, 'Anklickbare zeigen');
      var bSpeichern = el('button', { 'class': 'bb-haupt' }, 'Speichern');
      var bVerwerfen = el('button', {}, 'Verwerfen');
      var bLive = el('button', {}, 'Veröffentlichen');
      var bEnde = el('button', {}, 'Beenden');
      [bZeigen, bSpeichern, bVerwerfen, bLive, bEnde].forEach(function (b) { leiste.appendChild(b); });
      leiste.appendChild(status);
      leiste.appendChild(el('div', { 'class': 'bb-tipp' },
        'Text anklicken und tippen. Enter übernimmt, Umschalt+Enter macht einen Zeilenumbruch, Esc bricht ab.' +
        (gesperrt ? ' ' + gesperrt + ' Texte sind nicht eindeutig und nur im Chat änderbar.' : '')));

      function offen() { return texte.filter(function (t) { return t.jetzt !== t.alt; }); }
      function zaehle() {
        var n = offen().length;
        bSpeichern.disabled = bVerwerfen.disabled = !n;
        status.textContent = n ? n + (n === 1 ? ' Änderung' : ' Änderungen') + ' nicht gespeichert' : 'Alles gespeichert.';
      }
      zaehle();

      bZeigen.onclick = function () { document.body.classList.toggle('bb-zeigen'); };
      bVerwerfen.onclick = function () {
        offen().forEach(function (t) { t.node.innerHTML = t.alt; t.jetzt = t.alt; t.node.classList.remove('bb-geaendert'); });
        zaehle();
      };
      bEnde.onclick = function () {
        if (offen().length && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
        location.href = location.pathname;
      };

      function speichern() {
        var liste = offen();
        if (!liste.length) return Promise.resolve(true);
        status.textContent = 'Speichere …';
        return fetch('/_bearbeiten/speichern', {
          method: 'POST', headers: KOPF,
          body: JSON.stringify({ pfad: location.pathname, aenderungen: liste.map(function (t) { return { alt: t.alt, neu: t.jetzt }; }) })
        }).then(function (r) { return r.json(); }).then(function (a) {
          if (!a.ok) { status.textContent = 'Nicht gespeichert: ' + a.fehler; return false; }
          liste.forEach(function (t) { t.alt = t.jetzt; t.node.classList.remove('bb-geaendert'); });
          zaehle();
          status.textContent = 'Gespeichert in der Datei. Noch nicht veröffentlicht.';
          return true;
        }).catch(function () { status.textContent = 'Bearbeiten-Server nicht erreichbar.'; return false; });
      }
      bSpeichern.onclick = speichern;

      bLive.onclick = function () {
        if (!confirm('Diese Seite jetzt auf tools.integri.de veröffentlichen? Sie ist danach öffentlich.')) return;
        speichern().then(function (ok) {
          if (!ok) return;
          status.textContent = 'Veröffentliche …';
          return fetch('/_bearbeiten/veroeffentlichen', { method: 'POST', headers: KOPF, body: JSON.stringify({ pfad: location.pathname }) })
            .then(function (r) { return r.json(); })
            .then(function (a) { status.textContent = a.ok ? a.meldung : 'Nicht veröffentlicht: ' + a.fehler; });
        });
      };
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

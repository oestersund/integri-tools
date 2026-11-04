/* =============================================================
   INTEGRI integri-seite.js — Verhalten für Inhaltsseiten
   Vergrößerung: Klick auf ein Bild im Fächer (.s-faecher [data-gross]) öffnet
   es groß über der Seite. Schließen mit Kreuz, Esc oder Klick
   daneben; blättern mit Pfeilen. Knöpfe statt Links, damit das Handy
   die Seiten nicht einzeln zum Herunterladen anbietet.
   Einbinden vor </body>: <script src="../assets/integri-seite.js"></script>
   ============================================================= */
(function () {
  'use strict';

  function start() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.s-faecher [data-gross]'));
    if (!links.length) return;

    var box = document.createElement('div');
    box.className = 's-gross';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Seitenansicht');
    box.hidden = true;
    // Bedienung sitzt am Bild, nicht an den Fensterrändern: bleibt sichtbar, auch wenn das Fenster breiter als der Bildschirm ist
    box.innerHTML =
      '<figure>' +
        '<div class="s-gross-kopf"><button type="button" class="s-gross-zu" aria-label="Schließen">&times; Schließen</button></div>' +
        '<img alt="">' +
        '<div class="s-gross-fuss">' +
          '<button type="button" class="s-gross-pfeil s-gross-zurueck" aria-label="Vorherige Seite">&#8249;</button>' +
          '<figcaption></figcaption>' +
          '<button type="button" class="s-gross-pfeil s-gross-vor" aria-label="Nächste Seite">&#8250;</button>' +
        '</div>' +
      '</figure>';
    document.body.appendChild(box);

    var bild = box.querySelector('img');
    var text = box.querySelector('figcaption');
    var zu = box.querySelector('.s-gross-zu');
    var aktuell = 0, vorher = null;

    function zeige(i) {
      aktuell = (i + links.length) % links.length;
      var img = links[aktuell].querySelector('img');
      bild.src = links[aktuell].getAttribute('data-gross');
      bild.alt = img ? img.alt : '';
      text.textContent = (aktuell + 1) + ' von ' + links.length + (img && img.alt ? ' · ' + img.alt : '');
    }
    function oeffne(i) {
      vorher = document.activeElement;
      zeige(i);
      box.hidden = false;
      document.documentElement.classList.add('s-gross-offen');
      zu.focus();
    }
    function schliesse() {
      box.hidden = true;
      document.documentElement.classList.remove('s-gross-offen');
      if (vorher) vorher.focus();
    }

    links.forEach(function (a, i) {
      a.addEventListener('click', function (ev) {
        oeffne(i);
      });
    });
    zu.addEventListener('click', schliesse);
    box.querySelector('.s-gross-zurueck').addEventListener('click', function () { zeige(aktuell - 1); });
    box.querySelector('.s-gross-vor').addEventListener('click', function () { zeige(aktuell + 1); });
    box.addEventListener('click', function (ev) { if (ev.target === box || ev.target.tagName === 'FIGURE') schliesse(); });
    document.addEventListener('keydown', function (ev) {
      if (box.hidden) return;
      if (ev.key === 'Escape') schliesse();
      else if (ev.key === 'ArrowLeft') zeige(aktuell - 1);
      else if (ev.key === 'ArrowRight') zeige(aktuell + 1);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

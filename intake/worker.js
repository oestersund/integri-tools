// ═══════════════════════════════════════════════════════════════
// INTEGRI — E-Mail Worker
// Empfängt Intake-Formular-Submissions und sendet zwei E-Mails
// via Brevo: Benachrichtigung an Tilman + Kopie an Absender.
//
// Umgebungsvariable (Cloudflare Secret):
//   BREVO_API_KEY  — Brevo API-Key
// ═══════════════════════════════════════════════════════════════

// ── Konfiguration ────────────────────────────────────────────
const EMPFAENGER_EMAIL = 'info@integri.de';
const EMPFAENGER_NAME  = 'Tilman Möller';
const ABSENDER_EMAIL   = 'info@integri.de';   // muss in Brevo verifiziert sein
const ABSENDER_NAME    = 'Tilman Möller – Integri';

// ── Frage-Labels (Du / Sie) ──────────────────────────────────
const LABELS = {
  du: {
    name:                'Name',
    rolle:               'Rolle / Funktion',
    branche:             'Branche',
    email:               'E-Mail-Adresse',
    unternehmensgroesse: 'Unternehmensgröße',
    tools:               'Welche KI-Tools nutzt du aktuell?',
    tools_andere:        'Andere Tools (Freitext)',
    tools_nutzungsart:   'Kostenlose oder Bezahl-Version?',
    einschraenkungen:    'Gibt es Einschränkungen oder Vorgaben? (z.B. Datenschutz, Compliance)',
    datenlage:           'Wo liegen deine Daten und Prozesse aktuell?',
    anwendungsfall:      'Nenne stichwortartig Anwendungsfälle, bei denen du KI heute schon einsetzt',
    erfahrungen:         'Welche Erfahrungen hast du bisher mit KI gemacht — was lief gut, was weniger?',
    ziel_koennen:        'Was willst du mit KI können, was heute nicht möglich ist?',
    erfolgsmessung:      'Beschreibe mit Stichworten, was diese Lösung auszeichnen soll.',
    zeithorizont:        'Bis wann möchtest du erste Ergebnisse sehen?',
    prioritaet:          'Welcher Aspekt hat für dich Priorität?',
    prioritaet_andere:   'Priorität — Sonstiges (Freitext)',
    vertiefung:          'Welche Themen oder Fragen sollen wir im nächsten Austausch vertiefen?',
    vertiefung_beispiel: 'Konkretes Beispiel, Problem oder Projekt',
    zeitbudget:          'Zeitbudget pro Woche für Weiterbildung / Umsetzung',
    format:              'Wunschformat',
  },
  sie: {
    name:                'Name',
    rolle:               'Rolle / Funktion',
    branche:             'Branche',
    email:               'E-Mail-Adresse',
    unternehmensgroesse: 'Unternehmensgröße',
    tools:               'Welche KI-Tools nutzen Sie aktuell?',
    tools_andere:        'Andere Tools (Freitext)',
    tools_nutzungsart:   'Kostenlose oder Bezahl-Version?',
    einschraenkungen:    'Gibt es Einschränkungen oder Vorgaben? (z.B. Datenschutz, Compliance)',
    datenlage:           'Wo liegen Ihre Daten und Prozesse aktuell?',
    anwendungsfall:      'Nennen Sie stichwortartig Anwendungsfälle, bei denen Sie KI heute schon einsetzen',
    erfahrungen:         'Welche Erfahrungen haben Sie bisher mit KI gemacht — was lief gut, was weniger?',
    ziel_koennen:        'Was möchten Sie mit KI können, was heute nicht möglich ist?',
    erfolgsmessung:      'Beschreiben Sie mit Stichworten, was diese Lösung auszeichnen soll.',
    zeithorizont:        'Bis wann möchten Sie erste Ergebnisse sehen?',
    prioritaet:          'Welcher Aspekt hat für Sie Priorität?',
    prioritaet_andere:   'Priorität — Sonstiges (Freitext)',
    vertiefung:          'Welche Themen oder Fragen sollen wir im nächsten Austausch vertiefen?',
    vertiefung_beispiel: 'Konkretes Beispiel, Problem oder Projekt',
    zeitbudget:          'Zeitbudget pro Woche für Weiterbildung / Umsetzung',
    format:              'Wunschformat',
  }
};

// ── Reihenfolge + Abschnitte für die E-Mail ──────────────────
const SEKTIONEN = [
  {
    titel:  'Kontext',
    felder: ['name', 'rolle', 'branche', 'email', 'unternehmensgroesse']
  },
  {
    titel:  'Status quo',
    felder: ['tools', 'tools_andere', 'tools_nutzungsart', 'einschraenkungen', 'datenlage', 'anwendungsfall', 'erfahrungen']
  },
  {
    titel:  'Ziel',
    felder: ['ziel_koennen', 'erfolgsmessung', 'zeithorizont', 'prioritaet', 'prioritaet_andere']
  },
  {
    titel:  'Nächster Austausch',
    felder: ['vertiefung', 'vertiefung_beispiel']
  },
  {
    titel:  'Rahmenbedingungen',
    felder: ['zeitbudget', 'format']
  }
];

// ── HTML-E-Mail bauen ─────────────────────────────────────────
function buildEmail(data, anrede, fuerAbsender) {
  const labels   = LABELS[anrede] || LABELS.du;
  const name     = data.name || data.name_warm || data.pseudonym || '—';
  const kontext  = data._context || 'website';

  const preheader = fuerAbsender
    ? (anrede === 'sie'
        ? 'Hier kommen Ihre Antworten im Überblick.'
        : 'Hier kommen deine Antworten im Überblick.')
    : `Neue Einreichung von ${name}`;

  let sektionenHTML = '';

  for (const sektion of SEKTIONEN) {
    let zeilenHTML = '';
    for (const feld of sektion.felder) {
      const wert = (data[feld] || '').trim();
      if (!wert) continue;
      const label = labels[feld] || feld;
      zeilenHTML += `
        <tr>
          <td style="padding:10px 16px 2px;font-size:12px;color:#888;font-weight:600">${escHtml(label)}</td>
        </tr>
        <tr>
          <td style="padding:2px 16px 14px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f0f0f0">${escHtml(wert).replace(/\n/g, '<br>')}</td>
        </tr>`;
    }
    if (!zeilenHTML) continue;
    sektionenHTML += `
      <tr>
        <td style="padding:16px 16px 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00A896;border-top:2px solid #00A896">${escHtml(sektion.titel)}</td>
      </tr>
      ${zeilenHTML}`;
  }

  const grusszeile = fuerAbsender
    ? (anrede === 'sie'
        ? `<p style="margin:0 0 16px">vielen Dank für Ihre Antworten. Zur Übersicht finden Sie hier eine Kopie Ihrer Eingaben.</p>`
        : `<p style="margin:0 0 16px">vielen Dank für deine Antworten. Zur Übersicht findest du hier eine Kopie deiner Eingaben.</p>`)
    : `<p style="margin:0 0 16px">Es liegt eine neue Einreichung vor.</p>`;

  const anredeZeile = fuerAbsender
    ? (anrede === 'sie' ? 'Guten Tag,' : 'Hallo,')
    : 'Hallo Tilman,';

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <!-- Preheader -->
  <span style="display:none!important;mso-hide:all;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:0;max-height:0;overflow:hidden">${escHtml(preheader)}</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#fff;border-bottom:3px solid #00A896;padding:20px 24px">
            <span style="font-size:22px;font-weight:700;color:#00A896;letter-spacing:0.04em">INTEGRI</span>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:24px 24px 0">
            <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#1a1a1a">${anredeZeile}</p>
            ${grusszeile}
            ${data._anlass ? `<p style="margin:0;font-size:12px;color:#aaa">Anlass: ${escHtml(data._anlass)}</p>` : ''}
          </td>
        </tr>

        <!-- Antworten -->
        <tr>
          <td style="padding:16px 8px 8px">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${sektionenHTML}
            </table>
          </td>
        </tr>

        <!-- Abschluss (nur für Absender-Kopie) -->
        ${fuerAbsender ? `
        <tr>
          <td style="padding:20px 24px 0;font-size:14px;color:#1a1a1a;line-height:1.6">
            ${anrede === 'sie'
              ? 'Sollten Ihnen noch weitere Dinge / Ergänzungen einfallen, senden Sie mir eine Mail.<br><br>Viele Grüße,<br>Tilman Möller.'
              : 'Sollten dir noch weitere Dinge / Ergänzungen einfallen, sende mir eine Mail.<br><br>Viele Grüße,<br>Tilman.'}
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 24px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:12px;color:#bbb">
              KI-Mentoring Intake &nbsp;·&nbsp; tools.integri.de/intake/
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── HTML escapen ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Brevo API aufrufen ────────────────────────────────────────
async function sendBrevo(payload, apiKey) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':      apiKey,
      'Content-Type': 'application/json',
      'Accept':       'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${res.status}: ${text}`);
  }
  return res.json();
}

// ── CORS-Header ───────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Request-Handler ───────────────────────────────────────────
export default {
  async fetch(request, env) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const anrede       = data._anrede === 'sie' ? 'sie' : 'du';
    const name         = (data.name || data.name_warm || data.pseudonym || 'Unbekannt').trim();
    const absenderMail = (data.email || '').trim();

    try {
      // ── E-Mail 1: Benachrichtigung an Tilman ─────────────
      await sendBrevo({
        sender:      { name: ABSENDER_NAME, email: ABSENDER_EMAIL },
        to:          [{ email: EMPFAENGER_EMAIL, name: EMPFAENGER_NAME }],
        subject:     `KI-Mentoring Intake — ${name}`,
        htmlContent: buildEmail(data, anrede, false)
      }, env.BREVO_API_KEY);

      // ── E-Mail 2: Kopie an Absender (wenn E-Mail vorhanden) ──
      if (absenderMail) {
        await sendBrevo({
          sender:      { name: ABSENDER_NAME, email: ABSENDER_EMAIL },
          to:          [{ email: absenderMail }],
          subject:     anrede === 'sie'
            ? 'Ihre Antworten — KI-Mentoring'
            : 'Deine Antworten — KI-Mentoring',
          htmlContent: buildEmail(data, anrede, true)
        }, env.BREVO_API_KEY);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }
};

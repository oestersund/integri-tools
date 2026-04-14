<?php
/**
 * Claude API Proxy
 * Nimmt Briefing-JSON entgegen, leitet an Anthropic API weiter,
 * gibt strukturiertes Content-JSON fuer das Content Review Tool zurueck.
 *
 * POST /claude-proxy.php  { "briefing": { ...briefing fields... } }
 *                      →  { "hero": {...}, "intro": {...}, ... }
 *
 * API-Key: /config/anthropic.php (ausserhalb Webroot ablegen)
 */

// --- Config laden ---
// Pfad anpassen falls Config ausserhalb Webroot liegt:
// z.B. require_once dirname(__DIR__) . '/config/anthropic.php';
$configPath = __DIR__ . '/config/anthropic.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Config not found. Create config/anthropic.php with ANTHROPIC_API_KEY.']);
    exit;
}
require_once $configPath;

// --- CORS ---
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://tools.integri.de');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// --- Input validieren ---
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!$input || empty($input['briefing']) || !is_array($input['briefing'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid briefing data']);
    exit;
}

$briefing = $input['briefing'];

// --- Prompt bauen ---
$systemPrompt = getSystemPrompt();
$userMessage  = buildUserMessage($briefing);

// --- Anthropic API aufrufen ---
$payload = json_encode([
    'model'      => 'claude-sonnet-4-6',
    'max_tokens' => 4096,
    'system'     => $systemPrompt,
    'messages'   => [['role' => 'user', 'content' => $userMessage]]
], JSON_UNESCAPED_UNICODE);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01'
    ]
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'cURL error: ' . $curlError]);
    exit;
}

if ($httpCode !== 200) {
    http_response_code(502);
    $upstream = json_decode($response, true);
    echo json_encode([
        'error'   => 'Anthropic API error',
        'code'    => $httpCode,
        'message' => $upstream['error']['message'] ?? $response
    ]);
    exit;
}

// --- Antwort parsen ---
$data = json_decode($response, true);
$text = $data['content'][0]['text'] ?? '';

// Markdown-Fences entfernen falls Claude sie trotzdem schreibt
$text = preg_replace('/^```(?:json)?\s*/s', '', $text);
$text = preg_replace('/\s*```$/s', '', $text);
$text = trim($text);

$content = json_decode($text, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid JSON in Claude response',
        'raw'   => substr($text, 0, 500)
    ]);
    exit;
}

echo json_encode($content, JSON_UNESCAPED_UNICODE);


// ============================================================
// PROMPTS
// ============================================================

function getSystemPrompt(): string {
    return <<<PROMPT
Du bist ein deutschsprachiger Website-Texter. Du bekommst Briefing-Daten einer deutschen Agentur-Website.
Deine Aufgabe: Erstelle Website-Content für 13 Landing-Page-Sektionen.

Regeln:
- Kein Marketing-Deutsch, keine leeren Phrasen
- Übersetze abstrakte Eigenschaften in konkrete Kundennutzen und Alltagsszenarien
  Schlecht: "Gute Kommunikation" | Gut: "Rückmeldung innerhalb von 24 Stunden — kein Nachfragen nötig"
  Schlecht: "Hohe Qualität" | Gut: "Kein Nachbessern, kein zweites Mal beauftragen"
- Behalte die Sprache der Zielgruppe (aus integri-target-primary)
- Testimonials: Wenn keine echten vorhanden, erstelle glaubwürdige Platzhalter passend zur Branche
- Ausgabe: NUR gültiges JSON. Kein Markdown, keine Erklärungen davor oder danach.
PROMPT;
}

function buildUserMessage(array $b): string {
    $briefingJson = json_encode($b, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    return <<<MSG
Briefing-Daten:
{$briefingJson}

Erstelle basierend auf diesen Daten folgendes JSON (alle Felder auf Deutsch, kein Feld leer lassen):

{
  "hero": {
    "h1": "Hauptüberschrift. Falls integri-keyword-main gesetzt: mit Keyword. Sonst aus integri-topic ableiten."
  },
  "intro": {
    "h2": "Subheadline, 3-5 Worte, kein vollständiger Satz",
    "text": "2 Absätze (getrennt durch \\n\\n). Absatz 1: konkretes Problem der Zielgruppe in deren Sprache. Absatz 2: wie das Unternehmen das löst, konkret nicht abstrakt."
  },
  "stats": {
    "stat1": "Zahl oder Fakt\\nEine Zeile Erklärung",
    "stat2": "Zahl oder Fakt\\nEine Zeile Erklärung",
    "stat3": "Zahl oder Fakt\\nEine Zeile Erklärung"
  },
  "problems": {
    "title": "Sektionsüberschrift",
    "problem1": "Konkretes Problem in Alltagssprache der Zielgruppe (kein 'mangelnde X')",
    "problem2": "Konkretes Problem",
    "problem3": "Konkretes Problem",
    "solution1": "Konkrete Lösung mit messbarem Nutzen",
    "solution2": "Konkrete Lösung",
    "solution3": "Konkrete Lösung"
  },
  "usps": {
    "title": "Sektionsüberschrift",
    "usp1_title": "USP-Titel (kurz, prägnant)",
    "usp1_text": "Was bedeutet das konkret für den Kunden? Ein Alltagsszenario oder messbares Ergebnis.",
    "usp2_title": "USP-Titel",
    "usp2_text": "Konkreter Kundennutzen",
    "usp3_title": "USP-Titel",
    "usp3_text": "Konkreter Kundennutzen"
  },
  "trust": {
    "trust1": "Trust-Element aus integri-trust: Zahl oder Fakt + kurze Erklärung",
    "trust2": "Trust-Element",
    "trust3": "Trust-Element"
  },
  "services": {
    "title": "Sektionsüberschrift",
    "service1": "Leistungsbeschreibung, Block 1 aus integri-services",
    "service2": "Leistungsbeschreibung, Block 2 aus integri-services"
  },
  "cta1": {
    "title": "Niedrigschwelliger CTA-Titel im Frage-Format, bezogen auf konkreten Kundennutzen",
    "features": "✓ Feature 1\\n✓ Feature 2\\n✓ Feature 3\\n✓ Unverbindlich & kostenfrei"
  },
  "pricing": {
    "title": "Sektionsüberschrift",
    "info": "Preisstruktur aus integri-calculation, konkret und transparent formuliert"
  },
  "cases": {
    "case1_title": "Referenz-Titel",
    "case1_challenge": "Herausforderung",
    "case1_solution": "Lösung",
    "case1_result": "Ergebnis — mit konkreter Zahl wenn möglich",
    "case2_title": "Referenz-Titel",
    "case2_challenge": "Herausforderung",
    "case2_solution": "Lösung",
    "case2_result": "Ergebnis"
  },
  "testimonials": {
    "title": "Stimmen unserer Kunden",
    "quote1": "Echtes Zitat aus integri-testimonials oder glaubwürdiger Platzhalter passend zur Branche",
    "author1": "Vorname N., Position oder Kontext",
    "quote2": "Zitat",
    "author2": "Vorname N., Position oder Kontext",
    "quote3": "Zitat",
    "author3": "Vorname N., Position oder Kontext"
  },
  "faq": {
    "title": "Häufige Fragen",
    "q1": "Frage", "a1": "Antwort",
    "q2": "Frage", "a2": "Antwort",
    "q3": "Frage", "a3": "Antwort",
    "q4": "Frage", "a4": "Antwort",
    "q5": "Frage", "a5": "Antwort",
    "q6": "Frage", "a6": "Antwort",
    "alternatives": "Abgrenzung zu Alternativen aus integri-alternatives, sachlich formuliert"
  },
  "cta2": {
    "title": "Finaler CTA-Titel, Ergebnis-basiert aus integri-results",
    "btn1": "Button-Text niedrigschwellig (aus integri-cta-low)",
    "btn2": "Button-Text Hauptaktion (aus integri-cta-main)"
  }
}
MSG;
}

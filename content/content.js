// ── Hooked? — Detection Layer ─────────────────────────────────────────────────
// Depends on HOOKED_CONFIG injected by config.js

// ── Utilities ─────────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; for (let j = 1; j <= n; j++) dp[i][j] = 0; }
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function extractDomain(str) {
  try {
    const url = str.includes('://') ? str : 'https://' + str;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return str.toLowerCase();
  }
}

function looksLikeDomain(text) {
  const t = text.trim();
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/.test(t)
    && !t.includes(' ') && t.length < 100;
}

function keywordScan(text, keywords) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const kw of keywords) {
    if (lower.includes(kw) && !matched.includes(kw)) matched.push(kw);
  }
  return { count: matched.length, phrases: matched };
}

function extractLinks() {
  return Array.from(document.querySelectorAll('a[href]'))
    .map(a => ({ text: (a.innerText || a.textContent || '').trim(), href: a.href }))
    .filter(l => l.href.startsWith('http'));
}

function isMajorDomain(domain) {
  const base = domain.replace(/^www\./, '');
  return HOOKED_CONFIG.majorDomains.some(m => base === m || base.endsWith('.' + m));
}

function checkBrandImpersonation(domain) {
  if (!domain) return { flagged: false };
  let bestMatch = null, bestDist = Infinity;
  for (const brand of HOOKED_CONFIG.knownBrands) {
    const dist = levenshtein(domain, brand);
    if (dist < bestDist) { bestDist = dist; bestMatch = brand; }
  }
  return (bestDist <= 2 && domain !== bestMatch)
    ? { flagged: true, matchedBrand: bestMatch, distance: bestDist }
    : { flagged: false };
}

// ── Data Extraction ───────────────────────────────────────────────────────────

function extractGmailData() {
  let senderName = '', senderEmail = '', subject = '', body = '';

  const senderEl = document.querySelector('[email]');
  if (senderEl) {
    senderEmail = senderEl.getAttribute('email') || '';
    senderName  = senderEl.getAttribute('name')  || senderEl.innerText || '';
  }
  if (!senderEmail) {
    const hcEl = document.querySelector('[data-hovercard-id]');
    senderEmail = hcEl?.getAttribute('data-hovercard-id') || '';
  }

  const subjectEl = document.querySelector('h2.hP');
  subject = subjectEl?.innerText?.trim() || document.title;

  const bodyEl = document.querySelector('.a3s.aiL') || document.querySelector('.ii.gt div');
  body = bodyEl?.innerText?.slice(0, 20000) || document.body.innerText.slice(0, 20000);

  const senderDomain = senderEmail.includes('@')
    ? extractDomain(senderEmail.split('@')[1])
    : '';

  return { type: 'email', senderName, senderEmail, senderDomain, subject, body, links: extractLinks() };
}

function extractWebsiteData() {
  return {
    type: 'website',
    url: window.location.href,
    domain: extractDomain(window.location.hostname),
    title: document.title,
    text: document.body.innerText.slice(0, 20000),
    links: extractLinks(),
    hasPasswordInput: document.querySelectorAll('input[type="password"]').length > 0,
  };
}

// ── Signal + Score Computation ────────────────────────────────────────────────

function computeSignals(data) {
  const fullText = data.type === 'email'
    ? `${data.subject} ${data.body}`
    : `${data.title} ${data.text}`;

  const urgencyHits   = keywordScan(fullText, HOOKED_CONFIG.urgencyKeywords);
  const financialHits = keywordScan(fullText, HOOKED_CONFIG.financialKeywords);

  const linkMismatches = data.links.filter(l => {
    if (!looksLikeDomain(l.text)) return false;
    try { return extractDomain(l.text) !== extractDomain(l.href); }
    catch { return false; }
  }).length;

  const signals = { urgencyHits, financialHits, linkMismatches };

  if (data.type === 'website') {
    signals.domain = data.domain;
    signals.hasPasswordForm = data.hasPasswordInput;
    signals.brandImpersonation = checkBrandImpersonation(data.domain);
  }
  if (data.type === 'email') {
    signals.senderDomain = data.senderDomain;
    signals.brandImpersonation = checkBrandImpersonation(data.senderDomain);
  }

  return signals;
}

function computeScore(signals) {
  const { scoring, thresholds } = HOOKED_CONFIG;
  let score = 0;
  const reasons = [];

  const urgencyScore = Math.min(signals.urgencyHits.count * scoring.urgencyPerHit, scoring.urgencyCap);
  score += urgencyScore;
  if (signals.urgencyHits.count > 0)
    reasons.push(`Urgency language: "${signals.urgencyHits.phrases.slice(0, 3).join('", "')}"`);

  const financialScore = Math.min(signals.financialHits.count * scoring.financialPerHit, scoring.financialCap);
  score += financialScore;
  if (signals.financialHits.count > 0)
    reasons.push(`Credential/financial language: "${signals.financialHits.phrases.slice(0, 3).join('", "')}"`);

  const linkScore = Math.min(signals.linkMismatches * scoring.linkMismatchPerHit, scoring.linkMismatchCap);
  score += linkScore;
  if (signals.linkMismatches > 0)
    reasons.push(`${signals.linkMismatches} link(s) where display text doesn't match destination`);

  if (signals.hasPasswordForm && !isMajorDomain(signals.domain || '')) {
    score += scoring.passwordForm;
    reasons.push('Password form detected on non-major domain');
  }

  if (signals.brandImpersonation?.flagged) {
    score += scoring.brandImpersonation;
    reasons.push(`Domain may impersonate ${signals.brandImpersonation.matchedBrand}`);
  }

  score = Math.min(score, 100);
  const verdict = score >= thresholds.phishing ? 'phishing'
    : score >= thresholds.suspicious ? 'suspicious'
    : 'safe';

  return { score, verdict, reasons };
}

// ── Backend POST ──────────────────────────────────────────────────────────────

function postToBackend(payload) {
  try {
    chrome.runtime.sendMessage({ action: 'analyze', payload });
  } catch (e) {
    console.warn('[Hooked?] Could not send to background:', e.message);
  }
}

// ── Main Scan ─────────────────────────────────────────────────────────────────

function runScan() {
  const isGmail = window.location.hostname === 'mail.google.com';
  const data    = isGmail ? extractGmailData() : extractWebsiteData();
  const signals = computeSignals(data);
  const result  = computeScore(signals);

  console.log('[Hooked?] Scan complete', { score: result.score, verdict: result.verdict, reasons: result.reasons, signals, data });

  postToBackend({ data, signals, ...result });
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'run') {
    runScan();
    sendResponse({ message: 'Scan started' });
  }
  if (message.action === 'geminiResult') {
    console.log('[Hooked?] Gemini result:', message.result);
  }
});

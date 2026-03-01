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

let lastScanResult = null;

function runScan() {
  const isGmail = window.location.hostname === 'mail.google.com';
  const data    = isGmail ? extractGmailData() : extractWebsiteData();
  const signals = computeSignals(data);
  const result  = computeScore(signals);

  lastScanResult = { data, signals, ...result };
  postToBackend(lastScanResult);
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "run") {
    runScan();
    sendResponse({ message: "Scan started" });
  }

  if (message.action === "geminiResult") {
    const combined = { ...lastScanResult, gemini: message.result };
    console.log('[Hooked?] Final result', JSON.stringify(combined, null, 2));
  }
  
  if (message.action === "highlightKeywords") {
    const keywords = message.keywords || [];
    const enabled = message.enabled !== false;
    if (enabled && keywords.length > 0) {
      highlightKeywordsOnPage(keywords);
    } else {
      removeHighlights();
    }
    sendResponse({ message: "Highlighting applied" });
  }
});

// Highlight keywords/phrases on the current page
function highlightKeywordsOnPage(keywords) {
  removeHighlights();

  // Escape special regex chars so phrases like URLs don't crash the pattern
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const keywordPattern = new RegExp(`(${escaped.join('|')})`, 'gi');

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const nodesToReplace = [];
  let node;
  while (node = walker.nextNode()) {
    if (keywordPattern.test(node.textContent)) {
      nodesToReplace.push(node);
      keywordPattern.lastIndex = 0;
    }
  }

  nodesToReplace.forEach(node => {
    const span = document.createElement('span');
    span.innerHTML = node.textContent.replace(keywordPattern, '<mark class="henhacks-highlight">$1</mark>');
    node.parentNode.replaceChild(span, node);
  });
}

// Remove highlights added by this extension
function removeHighlights() {
  const highlights = document.querySelectorAll('mark.henhacks-highlight');
  highlights.forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });
}

// ---- Gmail-specific detection ------------------------------------------------
// Gmail is a single-page app that updates the hash when an email is opened.
// we watch for changes and notify the background script so it can open the popup.

let lastHref = location.href;
let gmailPollInterval = null;
let wasViewingEmail = false; // track if we were viewing an email thread

function safeSendMessage(message) {
  try {
    chrome.runtime.sendMessage(message);
  } catch (err) {
    // extension was likely reloaded/uninstalled; ignore the error
    console.warn("[HenHacks 26] sendMessage failed (context invalidated)", err);
  }
}

function checkGmailUrl() {
  // if the extension context is gone, just skip this run and wait for a later one
  // (don't remove the watcher; it will resume once the context is restored).
  if (!chrome || !chrome.runtime || !chrome.runtime.id) {
    console.debug("[HenHacks 26] runtime invalid, skipping URL check");
    return;
  }

  const href = location.href;
  if (href !== lastHref) {
    lastHref = href;
    // pattern: #inbox/... or other mailbox with a thread id starting FM
    const isViewingEmail = href.match(/#(?:inbox|sent|all)\/FM/);
    
    if (isViewingEmail) {
      safeSendMessage({ action: "gmailEmailOpened", url: href });
      wasViewingEmail = true;
    } else if (wasViewingEmail) {
      // Just navigated away from an email thread back to inbox/list view
      // Remove any highlights from the previous email
      removeHighlights();
      wasViewingEmail = false;
      console.log("[HenHacks 26] Left email thread, cleared highlights");
    }
  }
}

window.addEventListener("hashchange", checkGmailUrl);
// some Gmail navigation doesn't fire hashchange reliably, poll as a fallback
gmailPollInterval = setInterval(checkGmailUrl, 1000);

// clean up when the page unloads (especially important during extension reload)
window.addEventListener("unload", () => {
  if (gmailPollInterval) {
    clearInterval(gmailPollInterval);
    gmailPollInterval = null;
  }
});

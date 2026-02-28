// Content script — runs in the context of web pages.
// Listens for messages from the popup and watches Gmail URLs.

// Inject highlighting styles
const style = document.createElement('style');
style.textContent = `
  mark.henhacks-highlight {
    background-color: #ffeb3b;
    color: #000;
    font-weight: bold;
    padding: 2px 4px;
    border-radius: 2px;
    box-shadow: 0 0 3px rgba(255, 235, 59, 0.7);
  }
`;
document.head.appendChild(style);

// suppress the noisy "Extension context invalidated" log that happens during
// extension reloads; the error is thrown within Chrome's API and can't be caught
// by a try/catch around sendMessage, so intercept it globally.
window.addEventListener('error', (e) => {
  if (e?.message && e.message.includes('Extension context invalidated')) {
    // prevent it from appearing in devtools
    e.preventDefault();
    console.debug('[HenHacks 26] swallowed extension-invalidated error');
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "run") {
    console.log("[HenHacks 26] content script received 'run'");
    sendResponse({ message: "Content script executed" });
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

// Highlight keywords on the current page
function highlightKeywordsOnPage(keywords) {
  removeHighlights(); // remove existing highlights first
  
  const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
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
    if (href.match(/#(?:inbox|sent|all)\/FM/)) {
      safeSendMessage({ action: "gmailEmailOpened", url: href });
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

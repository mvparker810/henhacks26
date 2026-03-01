const BACKEND = 'http://localhost:8080/analyze';

// Holds the popup's sendResponse until the backend replies
let pendingPopupResponse = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Hooked?] Extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── From content script: Gmail email opened ────────────────────────────
  if (message.action === 'gmailEmailOpened') {
    // Check if auto-popup is enabled before opening
    chrome.storage.sync.get(['autoPopupEnabled'], (result) => {
      const autoPopupEnabled = result.autoPopupEnabled !== false; // default to true
      if (autoPopupEnabled) {
        console.log('[Hooked?] Gmail email opened, auto-opening popup');
        chrome.action.openPopup(() => {
          if (chrome.runtime.lastError) {
            console.warn('[Hooked?] Could not open popup:', chrome.runtime.lastError.message);
          }
        });
      } else {
        console.log('[Hooked?] Gmail email opened, but auto-popup is disabled');
      }
    });
    return;
  }

  // ── From popup: kick off a scan and wait for result ──────────────────────
  if (message.action === 'aiOverview') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ status: 'Error: no active tab' });
        return;
      }
      pendingPopupResponse = sendResponse;
      chrome.tabs.sendMessage(tabId, { action: 'run' }, (_resp) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded yet — inject it then retry
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/config.js', 'content/content.js'],
          }).then(() => {
            chrome.tabs.sendMessage(tabId, { action: 'run' });
          }).catch(e => {
            console.warn('[Hooked?] Could not inject scripts:', e.message);
            if (pendingPopupResponse) {
              pendingPopupResponse({ status: 'Error: cannot scan this page' });
              pendingPopupResponse = null;
            }
          });
        }
      });
    });
    return true; // keep channel open for async response
  }

  // ── From content script: POST payload to backend ──────────────────────────
  if (message.action === 'analyze') {
    const tabId = sender.tab?.id;

    fetch(BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.payload),
    })
      .then(r => r.json())
      .then(response => {
        console.log('[Hooked?] Backend ack:', response.server_time);

        // Forward gemini result back to the content script tab
        if (response.gemini && tabId != null) {
          chrome.tabs.sendMessage(tabId, { action: 'geminiResult', result: response.gemini });
        }

        // Send result back to popup if it's waiting
        if (pendingPopupResponse) {
          pendingPopupResponse({
            baseline: response.baseline,
            gemini: response.gemini,
            audio_base64: response.audio_base64 ?? null,
          });
          pendingPopupResponse = null;
        }
      })
      .catch(e => {
        console.warn('[Hooked?] Backend unreachable:', e.message);
        if (pendingPopupResponse) {
          pendingPopupResponse({ status: 'Backend unreachable' });
          pendingPopupResponse = null;
        }
      });
  }
});

const BACKEND = 'http://localhost:8080/analyze';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Hooked?] Extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  if (message.action !== 'analyze') return;

  const tabId = sender.tab?.id;

  fetch(BACKEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message.payload),
  })
    .then(r => r.json())
    .then(response => {
      console.log('[Hooked?] Backend ack:', response.server_time);
      if (response.gemini && tabId != null) {
        chrome.tabs.sendMessage(tabId, { action: 'geminiResult', result: response.gemini });
      }
    })
    .catch(e => console.warn('[Hooked?] Backend unreachable:', e.message));
});

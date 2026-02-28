// Background service worker — runs independently of any page or popup.
chrome.runtime.onInstalled.addListener(() => {
  console.log("[HenHacks 26] Extension installed.");
});

// Example: listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[HenHacks 26] background received:", message, "from:", sender.tab?.url);

  if (message.action === "aiOverview") {
    const pageUrl = message.url || sender.tab?.url || "";
    // placeholder for AI request; replace with real API call
    // example: fetch('https://api.example.com/overview', { method:'POST', body: JSON.stringify({ url: pageUrl })})
    //   .then(res => res.json())
    //   .then(data => sendResponse({ status: 'OK', overview: data.summary }))
    //   .catch(err => sendResponse({ status: 'error', error: err.toString() }));

    // for now just send a dummy overview using the URL
    const dummy = `AI overview for ${pageUrl}: this site appears suspicious and may contain phishing content.`;
    
    // BACKEND ANALYSIS: Extract keywords from the overview that should be highlighted (common phishing indicators)
    const keywords = extractKeywords(dummy);
    
    sendResponse({ status: "fetched", overview: dummy, keywords: keywords });

    // keep the message channel open for async response (not needed for synchronous dummy)
    return true;
  }

  if (message.action === "gmailEmailOpened") {
    console.log("[HenHacks 26] Gmail email opened, checking auto-popup setting");
    // read the preference from storage; default to enabled (true)
    chrome.storage.sync.get(["autoPopupEnabled"], (result) => {
      if (result.autoPopupEnabled !== false) {
        // attempt to open the extension popup in the tab where the email was opened
        chrome.action.openPopup(() => {
          if (chrome.runtime.lastError) {
            console.warn("could not open popup:", chrome.runtime.lastError);
          }
        });
      } else {
        console.log("[HenHacks 26] auto-popup disabled, not opening.");
      }
    });
  }

  // other message handling can go here
});

// BACKEND ANALYSIS: Helper function to extract important keywords from AI overview for highlighting
// Scans the AI-generated text for common phishing and security threat indicators
function extractKeywords(text) {
  const keywords = ["suspicious", "phishing", "malicious", "spam", "fraud", "scam", "dangerous", "warning", "alert"];
  const found = [];
  keywords.forEach(keyword => {
    if (text.toLowerCase().includes(keyword)) {
      found.push(keyword);
    }
  });
  return found;
}

// Background service worker — runs independently of any page or popup.
chrome.runtime.onInstalled.addListener(() => {
  console.log("[HenHacks 26] Extension installed.");
});

// Example: listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[HenHacks 26] background received:", message, "from:", sender.tab?.url);
  // sendResponse({ ... }) if needed
});

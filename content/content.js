// Content script — runs in the context of web pages.
// Listens for messages from the popup.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "run") {
    // TODO: add your page interaction logic here
    console.log("[HenHacks 26] content script received 'run'");
    sendResponse({ message: "Content script executed" });
  }
});

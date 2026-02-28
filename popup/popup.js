// helper: update overview and status text
function updateOverview(response) {
  if (chrome.runtime.lastError) {
    document.getElementById("status").textContent = "Error: could not contact background.";
    return;
  }
  document.getElementById("status").textContent = response?.status ?? "Done";
  if (response?.overview) {
    document.getElementById("ai-overview").textContent = response.overview;
  }
  
  // Apply keyword highlighting if enabled and keywords are available
  if (response?.keywords && document.getElementById("highlight-toggle")?.checked) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: "highlightKeywords", 
          keywords: response.keywords,
          enabled: true
        });
      }
    });
  }
}

// main setup when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const actionBtn = document.getElementById("action-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const languageSelect = document.getElementById("language-select");
  const highlightToggle = document.getElementById("highlight-toggle");
  const autoPopupToggle = document.getElementById("auto-popup-toggle");

  // translation table for a few labels
  const translations = {
    en: { scan: "Scan Now", overview: "Scan Here to Check for Phishing", ready: "Ready" },
    es: { scan: "Escanear ahora", overview: "Escanee aquí para detectar phishing", ready: "Listo" },
    fr: { scan: "Analyser", overview: "Analysez ici pour détecter le phishing", ready: "Prêt" },
  };

  function applyLanguage(lang) {
    const t = translations[lang] || translations.en;
    actionBtn.textContent = t.scan;
    document.getElementById("ai-overview").textContent = t.overview;
    document.getElementById("status").textContent = t.ready;
  }

  // load stored preferences (language, highlighting, auto-popup)
  chrome.storage.sync.get(["language", "highlightEnabled", "autoPopupEnabled"], (result) => {
    if (result.language) {
      languageSelect.value = result.language;
      applyLanguage(result.language);
    } else {
      // apply default english labels
      applyLanguage('en');
    }
    // load highlighting preference (default: true)
    highlightToggle.checked = result.highlightEnabled !== false;
    // load auto-popup preference (default: true)
    autoPopupToggle.checked = result.autoPopupEnabled !== false;

    // attempt to auto-run scan if the popup opened on a Gmail email
    maybeAutoScan();
  });

  // Toggle settings panel visibility when settings button is clicked
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  languageSelect.addEventListener("change", () => {
    const lang = languageSelect.value;
    chrome.storage.sync.set({ language: lang });
    applyLanguage(lang);
  });

  highlightToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ highlightEnabled: highlightToggle.checked });
  });

  autoPopupToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ autoPopupEnabled: autoPopupToggle.checked });
  });

  // if the popup is opened and the tab is a Gmail email, trigger scan automatically
  async function maybeAutoScan() {
    if (!autoPopupToggle.checked) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /#(?:inbox|sent|all)\/FM/.test(tab.url)) {
      actionBtn.click();
    }
  }

  actionBtn.addEventListener("click", async () => {
    // Hide settings panel and perform scan
    settingsPanel.classList.add("hidden");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ action: "aiOverview", url: tab.url }, updateOverview);
  });
});

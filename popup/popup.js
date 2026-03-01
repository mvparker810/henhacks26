// helper: update overview and display scan results
function updateOverview(response) {
  if (chrome.runtime.lastError) {
    document.getElementById("ai-overview").textContent = "Error: could not contact background.";
    const actionBtn = document.getElementById("action-btn");
    actionBtn.textContent = "Re-scan";
    return;
  }

  // Extract danger score and summary from gemini result
  if (response?.gemini) {
    const dangerScore = response.gemini.danger_score ?? 0;
    const summary = response.gemini.summary ?? "No summary available";
    
    // Display danger score with risk level label
    const dangerDisplay = document.getElementById("danger-display");
    const dangerPercentage = document.getElementById("danger-percentage");
    const riskOverviewTitle = document.getElementById("risk-overview-title");
    const aiOverview = document.getElementById("ai-overview");
    
    dangerDisplay.classList.remove("hidden");
    dangerDisplay.classList.add("fade-in");
    riskOverviewTitle.classList.remove("hidden");
    riskOverviewTitle.classList.add("fade-in-delayed");
    aiOverview.classList.add("fade-in-delayed");
    
    // Determine risk level label and color based on score
    let riskLabel = "";
    let riskColor = "#388e3c"; // default green
    
    if (dangerScore >= 80) {
      riskLabel = `HOOKED!: ${dangerScore}%`;
      riskColor = "#d32f2f"; // red
    } else if (dangerScore >= 60) {
      riskLabel = `Danger: ${dangerScore}%`;
      riskColor = "#d32f2f"; // red
    } else if (dangerScore >= 40) {
      riskLabel = `Fishy: ${dangerScore}%`;
      riskColor = "#f57c00"; // orange
    } else if (dangerScore >= 20) {
      riskLabel = `Low Risk: ${dangerScore}%`;
      riskColor = "#fbc02d"; // yellow
    } else {
      riskLabel = `Safe: ${dangerScore}%`;
      riskColor = "#388e3c"; // green
    }
    
    dangerPercentage.textContent = riskLabel;
    dangerPercentage.style.color = riskColor;
    
    // Update progress bar
    const dangerBar = document.getElementById("danger-bar");
    dangerBar.style.width = `${dangerScore}%`;
    dangerBar.style.backgroundColor = riskColor;
    
    // Display summary as overview and change button text to Re-scan
    document.getElementById("ai-overview").textContent = summary;
    const actionBtn = document.getElementById("action-btn");
    actionBtn.textContent = "Re-scan";
    
    // Extract and highlight fishy keywords from common phishing indicators
    const fishyKeywords = ["suspicious", "phishing", "malicious", "spam", "fraud", "scam", "dangerous", "warning", "alert", "urgent", "verify", "confirm", "click", "act now"];
    const highlightToggle = document.getElementById("highlight-toggle");
    
    if (highlightToggle?.checked) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Send keywords to content script for highlighting
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: "highlightKeywords", 
            keywords: fishyKeywords,
            enabled: true
          });
        }
      });
    }
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
    en: { scan: "Scan Now", overview: "Scan Here to Check for Phishing" },
    es: { scan: "Escanear ahora", overview: "Escanee aquí para detectar phishing" },
    fr: { scan: "Analyser", overview: "Analysez ici para detectar el phishing" },
  };

  function applyLanguage(lang) {
    const t = translations[lang] || translations.en;
    actionBtn.textContent = t.scan;
    document.getElementById("ai-overview").textContent = t.overview;
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
    // load highlighting preference (default: true if not set)
    if ('highlightEnabled' in result) {
      highlightToggle.checked = result.highlightEnabled;
    } else {
      highlightToggle.checked = true;
    }
    // load auto-popup preference (default: true if not set)
    if ('autoPopupEnabled' in result) {
      autoPopupToggle.checked = result.autoPopupEnabled;
    } else {
      autoPopupToggle.checked = true;
    }
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


  actionBtn.addEventListener("click", async () => {
    // Store original button text on first click, change to Scanning..., hide settings panel
    settingsPanel.classList.add("hidden");
    if (!actionBtn.dataset.scanned) {
      actionBtn.dataset.scanned = true;
    }
    actionBtn.textContent = "Scanning...";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ action: "aiOverview", url: tab.url }, updateOverview);
  });
});

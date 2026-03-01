// Global audio player state
let currentAudio = null;
let isPlaying = false;

// helper: update overview and display scan results
function updateOverview(response) {
  if (chrome.runtime.lastError) {
    document.getElementById("ai-overview").textContent = "Error: could not contact background.";
    const actionBtn = document.getElementById("action-btn");
    actionBtn.textContent = "Re-scan";
    actionBtn.classList.remove("scanning");
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
    const ttsBtn = document.getElementById("tts-btn");
    
    dangerDisplay.classList.remove("hidden");
    dangerDisplay.classList.add("fade-in");
    riskOverviewTitle.classList.remove("hidden");
    riskOverviewTitle.classList.add("fade-in-delayed");
    aiOverview.classList.add("fade-in-delayed");
    
    // Show TTS button if audio is available
    if (response.audio_base64) {
      ttsBtn.classList.remove("hidden");
      ttsBtn.classList.add("fade-in-delayed");
      currentAudio = response.audio_base64;
      isPlaying = false;
    }
    
    // Determine risk level label and color based on score
    let riskLabel = "";
    let riskColor = "#388e3c";

    if (dangerScore >= 80) {
      riskLabel = `HOOKED!: ${dangerScore}%`;
      riskColor = "#ff1744";
    } else if (dangerScore >= 60) {
      riskLabel = `Danger: ${dangerScore}%`;
      riskColor = "#ff5722";
    } else if (dangerScore >= 40) {
      riskLabel = `Fishy: ${dangerScore}%`;
      riskColor = "#ff9800";
    } else if (dangerScore >= 20) {
      riskLabel = `Low Risk: ${dangerScore}%`;
      riskColor = "#ffee58";
    } else {
      riskLabel = `Safe: ${dangerScore}%`;
      riskColor = "#00e676";
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
    actionBtn.classList.add("results-loaded");
    actionBtn.classList.remove("scanning");

    // Reasons bulleted
    const reasonsSection = document.getElementById("reasons-section");
    const reasonsList = document.getElementById("reasons-list");
    if (response.gemini.reasons_bulleted?.length) {
      reasonsList.innerHTML = "";
      response.gemini.reasons_bulleted.forEach(r => {
        const li = document.createElement("li");
        li.textContent = r;
        reasonsList.appendChild(li);
      });
      reasonsSection.classList.remove("hidden");
      reasonsSection.classList.add("fade-in-delayed");
    }

    // Next steps
    const nextStepsSection = document.getElementById("next-steps-section");
    if (response.gemini.next_steps) {
      document.getElementById("next-steps-text").textContent = response.gemini.next_steps;
      nextStepsSection.classList.remove("hidden");
      nextStepsSection.classList.add("fade-in-delayed");
    }
    
    // Highlight verbatim fishy phrases identified by Gemini
    const fishyPhrases = response.gemini.fishy_phrases ?? [];
    const highlightToggle = document.getElementById("highlight-toggle");

    if (highlightToggle?.checked && fishyPhrases.length) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "highlightKeywords",
            keywords: fishyPhrases,
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
  const ttsBtn = document.getElementById("tts-btn");

  // translation table for a few labels
  const translations = {
    en: { scan: "Check for Scam" },
    es: { scan: "Verificar estafa" },
    fr: { scan: "Vérifier l'arnaque" },
  };

  function applyLanguage(lang) {
    const t = translations[lang] || translations.en;
    actionBtn.textContent = t.scan;
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

  // Text-to-speech button handler
  ttsBtn.addEventListener("click", () => {
    if (!currentAudio) return;

    if (isPlaying) {
      // Stop playback if currently playing
      const audioElement = document.getElementById("tts-audio");
      if (audioElement) {
        audioElement.pause();
        audioElement.remove();
      }
      isPlaying = false;
      ttsBtn.classList.remove("playing");
    } else {
      // Start playback
      try {
        const binaryString = atob(currentAudio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(blob);
        
        const audioElement = document.createElement("audio");
        audioElement.id = "tts-audio";
        audioElement.src = audioUrl;
        audioElement.onended = () => {
          isPlaying = false;
          ttsBtn.classList.remove("playing");
          document.body.removeChild(audioElement);
        };
        document.body.appendChild(audioElement);
        audioElement.play();
        
        isPlaying = true;
        ttsBtn.classList.add("playing");
      } catch (err) {
        console.error("Error playing audio:", err);
      }
    }
  });


  actionBtn.addEventListener("click", async () => {
    // Reset TTS state when starting a new scan
    currentAudio = null;
    isPlaying = false;
    ttsBtn.classList.add("hidden");
    ttsBtn.classList.remove("playing");
    document.getElementById("reasons-section").classList.add("hidden");
    document.getElementById("next-steps-section").classList.add("hidden");
    
    // Store original button text on first click, change to Scanning..., hide settings panel
    settingsPanel.classList.add("hidden");
    if (!actionBtn.dataset.scanned) {
      actionBtn.dataset.scanned = true;
    }
    actionBtn.textContent = "Scanning...";
    actionBtn.classList.add("scanning");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ action: "aiOverview", url: tab.url }, updateOverview);
  });
});

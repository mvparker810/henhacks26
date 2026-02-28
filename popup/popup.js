document.getElementById("action-btn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "run" }, (response) => {
    if (chrome.runtime.lastError) {
      document.getElementById("status").textContent = "Error: could not reach page.";
      return;
    }
    document.getElementById("status").textContent = response?.message ?? "Done";
  });
});

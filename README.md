# 🛡️ TODONAME
### Real-Time Email & Website Phishing Detection with Explainable AI

Protecting users from deception before damage occurs.

TODONAME is a Chrome Extension that detects phishing and manipulation in:

- 📧 Gmail emails  
- 🌐 Websites (any page)

It combines deterministic security signals with Gemini-powered AI reasoning to deliver explainable, actionable risk assessments directly in the browser.

---

# 🚨 Why This Exists

Most phishing tools either:

- ❌ Block sites without explanation  
- ❌ Give vague warnings  
- ❌ Fail to explain *why* something is dangerous  

TODONAME instead:

- Detects deception patterns
- Explains tactics clearly
- Helps users make safer decisions
- Builds trust through transparency

---

# 🧠 How It Works

TODONAME uses a two-layer architecture:

## 🔎 1. Detection Layer (Deterministic Signals)

The extension extracts structured signals from emails and websites.

### 📧 Email Signals
- Sender domain extraction
- Display name vs domain mismatch
- Reply-To mismatch
- Urgency keyword detection
- Financial / credential keyword detection
- Link text vs actual link mismatch

### 🌐 Website Signals
- Domain extraction
- Password form detection
- Urgency phrases in visible text
- Financial / credential keywords
- Link mismatches
- (Optional) Domain similarity to known brands

These signals create a stable baseline risk score.

---

## 🤖 2. AI Reasoning Layer (Gemini API)

Structured signals + extracted content are sent to Gemini.

Gemini returns:

```json
{
  "risk_score": 87,
  "verdict": "phishing",
  "tactics": ["impersonation", "urgency", "credential_harvesting"],
  "explanation": "This page attempts to impersonate Amazon and pressures the user to verify credentials immediately.",
  "recommended_action": "Do not enter any credentials. Close the page and navigate directly to the official site."
}
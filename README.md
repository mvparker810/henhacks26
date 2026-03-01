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
```

---

## Inspiration
Phishing attacks are one of the most common and effective forms of cybercrime — and most people can't tell they're being targeted until it's too late. Email platforms like Gmail do some filtering, but nothing explains *why* something is suspicious in plain language that anyone can understand. We wanted to build a tool that acts like a knowledgeable friend looking over your shoulder, telling you exactly what's wrong and what to do about it.

## What it does
**Hooked?** is a Chrome extension that scans emails and websites in real time for phishing signals. When you open an email in Gmail or hit "Scan Now" on any webpage, it:

- Runs a local heuristic analysis — checking for urgency language, credential-harvesting keywords, link destination mismatches, and brand impersonation
- Sends the content to a Gemini AI backend that produces a plain-English risk summary, a 0–100 danger score, a bulleted list of red flags, and recommended next steps
- Reads the summary aloud using ElevenLabs text-to-speech so you don't even have to read it
- Highlights suspicious keywords directly on the page

Settings let users choose their language (English, Spanish, French), toggle keyword highlighting, and enable automatic scanning when a new email is opened.

## How we built it
The extension is built on **Chrome Manifest V3** — a service worker acts as the message broker between the popup UI, the content scripts injected into pages, and the backend. The content scripts handle DOM extraction (Gmail email body, sender info, links) and run the local scoring engine. The service worker coordinates the async flow: popup → content script → backend → popup.

The backend is **Node.js + Express**, calling **Google Gemini** for AI analysis and **ElevenLabs** for text-to-speech synthesis. Audio is returned as base64 and played directly in the popup via the Web Audio API.

## Challenges we ran into
Getting Gemini working was harder than expected. Several model versions hit quota limits of zero on our API keys, and the SDK changed enough between versions that the integration had to be rewritten. We ended up adding a **testing mode** that returns a realistic sample JSON response with a simulated delay — this let us build and demo the full UI and audio pipeline without burning API quota or waiting on real AI responses.

Chrome's content script injection also caused a double-injection bug: the manifest loads `config.js` on every page, and the service worker's fallback injector would load it again, causing a `SyntaxError` on the declaration. The fix was switching to a guard pattern so the second injection is a no-op.

## Accomplishments that we're proud of
- A complete end-to-end pipeline: DOM extraction → local heuristics → AI analysis → voice readout, all triggered by one button click
- The ElevenLabs integration returning synthesized audio back through the extension message chain as base64 and playing it in the popup
- A local scoring engine that gives a meaningful baseline result even when the backend is unreachable

## What we learned
- Chrome Manifest V3 service workers are stateless and don't persist variables across restarts — designing around a temporary bridge for the async popup↔backend flow took iteration
- Gemini model availability and quota limits are unpredictable across accounts; building a testing mode early saved hours of blocked development time
- ElevenLabs voice quality is very sensitive to `stability` and `similarity_boost` — small tweaks to these parameters significantly change how the output sounds for a warning/alert context

## What's next for Hooked?
- A visual breakdown panel showing each risk factor and its contribution to the danger score
- Support for scanning attachments and QR codes embedded in emails
- A local ML model so the extension works fully offline without a backend
- Expanded language support beyond the current English, Spanish, and French UI
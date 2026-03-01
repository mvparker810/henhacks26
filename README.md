# Hooked?

## Inspiration
Phishing attacks are one of the most common forms of cybercrime, and most people can't tell they're being targeted until it's too late. Gmail filters obvious spam, but it never explains why something is dangerous in plain language.

This hits hard for people who aren't deeply tech-savvy. Older adults, first-time internet users, anyone who didn't grow up online. We built something that can act like a knowledgeable friend looking over your shoulder, pointing out the warning signs and telling you how to stay safe on the web.

## What it does
**Hooked?** is a Chrome extension that scans emails and websites for phishing in real time. When you open a Gmail email it auto-triggers, or you can hit **Run Scan** on any webpage. It:

- Checks for urgency language, suspicious links, credential harvesting, and brand impersonation
- Uses **Gemini AI** to produce a plain-English risk summary, a 0–100 danger score, and recommended next steps
- Highlights the specific suspicious phrases directly on the page
- Reads the summary aloud using **ElevenLabs** text-to-speech

Settings let you toggle keyword highlighting and auto-popup on new Gmail emails.

## How we built it
A Chrome Manifest V3 service worker brokers messages between the popup, the content scripts, and a Node.js/Express backend. Content scripts extract email or page content and run a local scoring engine. The service worker holds the response channel open while the backend calls Gemini for AI analysis, then forwards the result back to the popup and highlights suspicious phrases on the page. ElevenLabs TTS returns audio as base64, played via the Web Audio API.

## Challenges we ran into
Several Gemini model versions hit quota limits of zero on our API keys. We added a **testing mode** that returns a realistic sample response so we could build and demo the full pipeline without burning quota.

## Accomplishments that we're proud of
- A complete pipeline: DOM extraction > AI analysis > voice readout, all from one button click
- The ElevenLabs audio playing back through the extension message chain as base64 and playing in the popup

## What we learned
- Gemini quota limits are unpredictable. Building a testing mode early saved hours of blocked development
- ElevenLabs voice quality is very sensitive to `stability` and `similarity_boost`. Small tweaks matter a lot for a warning/alert context

## What's next for Hooked?
- Scanning attachments and QR codes in emails
- A local, fine-tuned AI model for fully offline detection
- Expanded language support
- Mobile App Support
- Generalization to scan websites
- Microsoft Edge support
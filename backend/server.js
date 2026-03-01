require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors    = require('cors');
const { GoogleGenAI } = require('@google/genai');

const TTS_MODEL = 'AeRdCCKzvd23BpJoofzx';
const TTS_VERSION = 'eleven_multilingual_v2';

const TESTING = false;     // ← set false to use real Gemini API
const TESTING_TTS = false; // ← set false to use real ElevenLabs TTS

const SAMPLE_GEMINI = {
  danger_score: 72,
  summary: 'This email is a high-risk phishing attempt designed to steal your banking credentials. Although it claims to be from Bank of America, the actual sender address (instructure.com) is completely unrelated to the bank. The message uses classic \'scare tactics,\' such as threatening to suspend your account, to trick you into clicking a suspicious link that does not lead to an official bank website.',
  reasons_bulleted: [
    "Sent from '@instructure.com', not Bank of America.",
    "Link goes to 'secure-account-verify-example.com', not bankofamerica.com.",
    "Uses urgent threats like 'permanent account suspension' to pressure you.",
    "Addresses you as 'Dear Customer' instead of your name.",
    "Link uses HTTP, not HTTPS — unsafe for financial info."
  ],
  next_steps: "Do not click the link or reply to the email. Delete this email immediately. If you are worried about the status of your bank account, open a new browser tab and manually type in 'bankofamerica.com' to log in securely, or call the number on the back of your official debit/credit card.",
  fishy_phrases: [
    "Dear Customer",
    "unusual activity on your account",
    "temporarily restricted access",
    "verify your identity immediately",
    "clicking the link below",
    "http://secure-account-verify-example.com",
    "Failure to verify within 24 hours",
    "permanent account suspension"
  ]
};

const app  = express();
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/analyze', async (req, res) => {
  const { data, signals, score: baselineScore, verdict: baselineVerdict } = req.body;

  console.log(`[analyze] type=${data?.type ?? '?'} baseline=${baselineScore} (${baselineVerdict})`);

  let geminiResult = null;

  if (TESTING) {
    console.log('[gemini] TESTING mode — simulating AI delay...');
     await new Promise(r => setTimeout(r, 7583));
    geminiResult = { ...SAMPLE_GEMINI, danger_score: 95 };
  } else if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = buildPrompt(data, signals, baselineScore);
      console.log('[gemini] prompt:\n' + prompt);
      const result = await genAI.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const text = result.text.trim();
      const json = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      geminiResult = JSON.parse(json);
      console.log(`[gemini] danger_score=${geminiResult.danger_score}`);
      console.log(`[gemini] summary=${geminiResult.summary}`);
      console.log(`[gemini] reasons=${JSON.stringify(geminiResult.reasons_bulleted)}`);
      console.log(`[gemini] next_steps=${geminiResult.next_steps}`);
    } catch (e) {
      console.error('[gemini] Error:', e.message);
    }
  } else {
    console.warn('[gemini] No API key set — skipping AI analysis');
  }

  let audioBase64 = null;
  if (!TESTING_TTS && process.env.ELEVENLABS_API_KEY && geminiResult?.summary) {
    try {
      const elevenRes = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + TTS_MODEL, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          {
            text: geminiResult.summary,
            model_id: TTS_VERSION,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              speed: 1.0
            },
          }),
      });
      if (!elevenRes.ok) {
        const err = await elevenRes.text();
        console.error('[elevenlabs] API error:', elevenRes.status, err);
      } else {
        const buf = await elevenRes.arrayBuffer();
        audioBase64 = Buffer.from(buf).toString('base64');
        console.log(`[elevenlabs] audio ready (${buf.byteLength} bytes)`);
      }
    } catch (e) {
      console.error('[elevenlabs] Error:', e.message);
    }
  }

  res.json({
    ok: true,
    baseline: { score: baselineScore, verdict: baselineVerdict },
    gemini: geminiResult,
    audio_base64: audioBase64,
    server_time: new Date().toISOString(),
  });
});

function buildPrompt(data, signals, baselineScore) {
  const header = data.type === 'email'
    ? `Type: Email\nFrom: ${data.senderEmail} (domain: ${data.senderDomain})\nSubject: ${data.subject}`
    : `Type: Website\nURL: ${data.url}\nDomain: ${data.domain}\nTitle: ${data.title}`;

  const excerpt = (data.type === 'email' ? data.body : data.text)?.slice(0, 2000) ?? '';

  const signalSummary = [
    `Urgency keywords (${signals.urgencyHits.count}): ${signals.urgencyHits.phrases.join(', ') || 'none'}`,
    `Financial/credential keywords (${signals.financialHits.count}): ${signals.financialHits.phrases.join(', ') || 'none'}`,
    `Link mismatches: ${signals.linkMismatches}`,
    data.type === 'website' ? `Password form detected: ${signals.hasPasswordForm}` : null,
    `Brand impersonation: ${signals.brandImpersonation?.flagged ? signals.brandImpersonation.matchedBrand : 'none'}`,
    `Baseline risk score: ${baselineScore}/100`,
  ].filter(Boolean).join('\n');

  return `Phishing detector. Score MUST be a multiple of 10 (0–100).
0=safe, 30=suspicious, 60=likely phishing, 90=confirmed phishing.
Add +30 for credential requests, +20 for link mismatch or threats, +10 for HTTP on financial pages.
Do NOT flag as suspicious: one-time codes or magic login links from a sender whose domain matches the service named in the email, standard account verification emails from known platforms (Google, GitHub, MLH, Slack, etc.), or password reset emails where the link domain matches the sender domain.

Respond ONLY with valid JSON:
{
  "danger_score": <0|10|20|30|40|50|60|70|80|90|100>,
  "summary": "<2-3 sentences, plain language>",
  "reasons_bulleted": ["<one sentence max, ≤12 words>"],
  "next_steps": "<1-2 sentences of actionable advice>",
  "fishy_phrases": ["<verbatim phrase from content>"]
}

${header}

Detected signals:
${signalSummary}

Content excerpt:
${excerpt}`;
}

const PORT = 8080;
app.listen(PORT, () => console.log(`Hooked? backend running on http://localhost:${PORT}`));

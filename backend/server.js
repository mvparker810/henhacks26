require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors    = require('cors');
const { GoogleGenAI } = require('@google/genai');

const TESTING = true; // ← set false to use real Gemini API

const SAMPLE_GEMINI = {
  danger_score: 72,
  summary: 'This email shows several hallmarks of a phishing attempt. The sender domain does not match the brand it claims to represent, and the message uses urgent language designed to pressure you into acting quickly without thinking.',
  reasons_bulleted: [
    'Sender domain does not match claimed brand',
    'Urgency language detected ("act now", "limited time")',
    'Link destination does not match display text',
  ],
  next_steps: 'Do not click any links or download attachments. Mark the email as phishing and report it to your email provider.',
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
    await new Promise(r => setTimeout(r, 500));
    geminiResult = { ...SAMPLE_GEMINI, danger_score: Math.floor(Math.random() * 101) };
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
  if (process.env.ELEVENLABS_API_KEY && geminiResult?.summary) {
    try {
      const elevenRes = await fetch('https://api.elevenlabs.io/v1/text-to-speech/AeRdCCKzvd23BpJoofzx', {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: geminiResult.summary, model_id: 'eleven_multilingual_v2' }),
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

  return `You are a phishing detection expert for the chrome extension "Hooked?'. 
  
  Analyze the following content and write your report with .json formatting, using THESE provided fields. Your repsonse should look something like:
  \"{
      danger_score: <A number from 0 - 100 representing how dangerous this email is>,

      summary: <A short 1-2 paragraph entry summarizing how safe or dangerous this ${data.type} appears to be. Be direct, and use regular terminology an average person can understand>
      reasons_bulleted: [an array of reasons and why thats chosen.]

      next_steps: <A description of doing next steps. Be direct, and use regular terminology an average person can understand>
    }
  \"
  
${header}

Detected signals:
${signalSummary}

Content excerpt:
${excerpt}`;
}

const PORT = 8080;
app.listen(PORT, () => console.log(`Hooked? backend running on http://localhost:${PORT}`));

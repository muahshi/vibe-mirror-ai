/**
 * /api/stylist.js — Vercel Serverless Function
 *
 * Receives: anonymized face metadata + occasion string
 * Returns:  compliment, product list, styling tip
 *
 * PRIVACY GUARANTEE: No face images ever touch this endpoint.
 * Only numerical ratios and categorical labels are received.
 */

export default async function handler(req, res) {
  // ── CORS (adjust origin in production) ──────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // ── Validate API Key ─────────────────────────────────────────────────────
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured in Vercel environment variables.' });
  }

  // ── Parse & Validate Body ────────────────────────────────────────────────
  let faceData, occasion;
  try {
    ({ faceData, occasion } = req.body);
    if (!faceData || !faceData.faceShape) throw new Error('Missing faceData');
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // ── Sanitize inputs ──────────────────────────────────────────────────────
  const safeOccasion = String(occasion || 'casual daytime look').slice(0, 200);
  const { faceShape, vibeScore, ratios } = faceData;

  // ── Build Groq Prompt ────────────────────────────────────────────────────
  const systemPrompt = `You are "Aura", the world's fastest and most empowering AI personal stylist.
Your personality: warm, confident, direct, like a best friend who happens to know everything about beauty.
Your mission: In every response, make the user feel SEEN, BEAUTIFUL, and EXCITED to try new products.

RULES:
- Compliment must feel GENUINE and SPECIFIC (reference their face shape or vibe score subtly)
- Products must be real Indian market brands: Sugar, Mamaearth, Lakme, MyGlamm, Nykaa brand, Dot & Key, Plum, etc.
- Each product MUST have an affiliate platform: Nykaa, Amazon, Myntra, or Purplle
- Keep product descriptions short (1 sentence, under 20 words)
- Tip must be hyper-contextual to the occasion (include weather/event specifics if mentioned)
- ALWAYS respond with ONLY valid JSON — no markdown, no extra text

JSON schema (respond with this exact structure):
{
  "compliment": "string (max 40 words, genuine, specific to face features)",
  "vibeScore": number (between 72 and 97),
  "products": [
    {
      "name": "Brand Product Name",
      "description": "One punchy sentence why it's perfect for them",
      "platform": "Nykaa|Amazon|Myntra|Purplle",
      "emoji": "💋|👁️|✨|💅|🌟 (pick most fitting)"
    }
  ],
  "tip": "string (one actionable styling tip for this specific occasion, max 35 words)"
}`;

  const userPrompt = `Analyze this beauty client:
- Face Shape: ${faceShape}
- Current Vibe Score: ${vibeScore}/100
- Facial Ratios: eye spacing ${ratios.eyeSpacing}, lip fullness ${ratios.lipFullness}, jaw-to-face ${ratios.jawToFace}
- Occasion: "${safeOccasion}"

Generate 3 perfectly curated products + 1 stunning compliment. Make them feel like a million dollars.`;

  // ── Call Groq API ────────────────────────────────────────────────────────
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        temperature:      0.85,
        max_tokens:       600,
        response_format:  { type: 'json_object' },
        // Groq is already ultra-fast; no special speed param needed
      }),
    });

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text();
      console.error('Groq error:', errBody);
      return res.status(502).json({ error: 'AI stylist is temporarily unavailable. Try again!' });
    }

    const groqData  = await groqResponse.json();
    const rawText   = groqData.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('JSON parse error. Raw:', rawText);
      return res.status(502).json({ error: 'AI response could not be parsed. Try again!' });
    }

    // Validate structure
    if (!parsed.compliment || !Array.isArray(parsed.products)) {
      return res.status(502).json({ error: 'Incomplete AI response. Try again!' });
    }

    // Safety: cap product count
    parsed.products = parsed.products.slice(0, 3);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Stylist API error:', err);
    return res.status(500).json({ error: 'Server error. Please try again in a moment.' });
  }
}


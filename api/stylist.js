/**
 * /api/stylist.js — Vercel Serverless Function v3
 *
 * Receives: anonymized face metadata, occasion, user name, goal
 * Returns:  personalized compliment, curated products, styling tip
 *
 * PRIVACY GUARANTEE: No face images ever touch this endpoint.
 * Only numerical ratios and categorical labels are received.
 */

export default async function handler(req, res) {
  // ── CORS ─────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // ── Validate API Key ──────────────────────────────────────────────────────
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: 'GROQ_API_KEY not configured in Vercel environment variables.'
    });
  }

  // ── Parse Body ─────────────────────────────────────────────────────────────
  const mode = req.body?.mode || 'scan';

  // ── CHAT MODE (stylist screen) ──────────────────────────────────────────
  if (mode === 'chat') {
    const { message = '', context = '', chatHistory = [], userName = '', goal = '' } = req.body;
    const cityCtx = req.body.city || 'Bhopal';
    const sysP = `You are Aura, a warm witty AI beauty bestie from India. You speak like a cool supportive best friend who's also a world-class makeup artist and skincare expert. You know Indian brands deeply (Sugar, Lakme, Nykaa, MyGlamm, Mamaearth, Dot & Key, Minimalist, Plum, etc). Be empowering, specific, and fun. Use occasional Hindi/Hinglish naturally. User: Name="${userName}", Goal="${goal}", City="${cityCtx}". Keep replies under 80 words. Always end with one actionable tip.`;
    const msgs = [
      { role: 'system', content: sysP },
      ...chatHistory.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      { role: 'user', content: String(message).slice(0, 400) }
    ];
    try {
      const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: msgs, temperature: 0.88, max_tokens: 250 })
      });
      const gd = await gr.json();
      return res.status(200).json({ reply: gd.choices?.[0]?.message?.content || 'You look amazing! 💫' });
    } catch { return res.status(502).json({ error: 'Chat unavailable' }); }
  }

  // ── SHOPPING BOT MODE ───────────────────────────────────────────────────
  if (mode === 'shopping_bot') {
    const { message = '', faceData: fd2, occasion: occ2 = '', userName: un2 = '', skinTone = 'medium', chatHistory: ch2 = [] } = req.body;
    const cityCtx2 = (occ2 + '').includes('Bhopal') ? 'Bhopal' : (req.body.city || 'Bhopal');
    const locationCtx2 = detectLocation(occ2 + cityCtx2);
    const fd2S = fd2 ? `Face: ${fd2.faceShape}, Vibe: ${fd2.vibeScore}/100, Skin tone: ${skinTone}` : `Skin tone: ${skinTone}`;
    const sbotSys = `You are an AI Shopping Stylist for Vibe Mirror AI — a premium beauty app. Your SOLE mission is to recommend products that the user NEEDS based on their scan data and city climate. Be persuasive, specific, and data-driven. Reference their face scan results. Create urgency when appropriate (e.g. "Bhopal's UV is damaging your glow RIGHT NOW").
User profile: ${fd2S}. Location: ${locationCtx2}. Name: ${un2 || 'beautiful'}.
Rules: Suggest only real Indian brands (Sugar, Nykaa, Lakme, MyGlamm, Mamaearth, Dot & Key, Minimalist, Plum, Biotique, Colorbar, Forest Essentials). Always include price in INR. Be warm but persuasive. Max 70 words per reply. ALWAYS recommend 1-2 specific products with prices.
Respond in JSON: { "reply": "your message", "products": [{"name":"...", "description":"...", "platform":"Nykaa|Amazon", "price":"number", "emoji":"💄", "affiliateUrl":"url"}] }`;
    const sbotMsgs = [
      { role: 'system', content: sbotSys },
      ...ch2.slice(-4).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: String(message).slice(0, 300) }
    ];
    try {
      const gr2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: sbotMsgs, temperature: 0.85, max_tokens: 400, response_format: { type: 'json_object' } })
      });
      const gd2 = await gr2.json();
      let parsed2 = {};
      try { parsed2 = JSON.parse(gd2.choices?.[0]?.message?.content || '{}'); } catch {}
      return res.status(200).json({ reply: parsed2.reply || 'Here are my picks for you!', products: parsed2.products || [] });
    } catch { return res.status(502).json({ error: 'Shopping bot unavailable', reply: 'Connection issue. Please try again!', products: [] }); }
  }

  // ── SCAN MODE (default) ──────────────────────────────────────────────────
  let faceData, occasion;
  try {
    ({ faceData, occasion } = req.body);
    if (!faceData || !faceData.faceShape) throw new Error('Missing faceData');
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const safeOccasion = String(occasion || 'casual daytime look').slice(0, 250);
  const { faceShape, vibeScore, symmetryScore, userName, goal, ratios } = faceData;
  const safeName = String(userName || 'Beautiful').slice(0, 30);
  const safeGoal = String(goal || 'Glow & Radiance').slice(0, 50);

  // ── Detect location for hyper-local context ───────────────────────────────
  const locationCtx = detectLocation(safeOccasion);

  // ── System Prompt ─────────────────────────────────────────────────────────
  const systemPrompt = `You are "Aura", the world's most premium and empowering AI personal beauty stylist.
Your personality: warm, sophisticated, direct — like a best friend who happens to be a world-class celebrity makeup artist.
Your mission: Make every user feel SEEN, RADIANT, and EXCITED.

ABOUT THE USER:
- Their name is ${safeName}
- Their beauty goal: ${safeGoal}
- Location context: ${locationCtx}

RULES:
- ALWAYS address the user by their first name (${safeName}) in the compliment
- Compliment must feel GENUINE, SPECIFIC, and slightly technical (reference face shape, symmetry, or skin quality)
- **WARDROBE PRIORITY**: If the occasion context mentions "User already owns:", you MUST reference those owned products first in your suggestions. Tell them HOW to use what they already own before recommending new purchases. This is the most important rule.
- For owned products: describe a specific application technique for their face shape
- For new products: suggest real Indian market brands: Sugar, Mamaearth, Lakme, MyGlamm, Nykaa, Dot & Key, Plum, Biotique, Minimalist, WOW, Faces Canada
- Each product MUST have a platform: Nykaa, Amazon, Myntra, or Purplle
- Tip must be hyper-specific to occasion AND location weather
- ALWAYS respond with ONLY valid JSON — no markdown, no extra text

JSON schema (respond with this EXACT structure):
{
  "compliment": "string (max 45 words, warm, specific, uses their name)",
  "vibeScore": number (between 78 and 97),
  "products": [
    {
      "name": "Brand Full Product Name",
      "description": "One punchy sentence why it's perfect (max 18 words). If owned: start with 'You own this —'",
      "platform": "Nykaa|Amazon|Myntra|Purplle",
      "price": "number without ₹ symbol",
      "emoji": "💋|👁️|✨|💅|🌟|💧|🌸",
      "owned": true or false
    }
  ],
  "tip": "string (one actionable, location-specific styling tip, max 40 words)"
}`;

  const userPrompt = `Analyze this client in a premium beauty consultation:

CLIENT PROFILE:
- Name: ${safeName}
- Beauty Goal: ${safeGoal}
- Face Shape: ${faceShape}
- Vibe Score: ${vibeScore}/100
- Symmetry Score: ${symmetryScore || 94}%
- Facial Ratios: eye spacing ${ratios.eyeSpacing}, lip fullness ${ratios.lipFullness}, jaw-to-face ${ratios.jawToFace}
- Occasion: "${safeOccasion}"
- Location Context: ${locationCtx}

Generate 3 perfectly curated Indian beauty products + 1 stunning personalized compliment that makes ${safeName} feel like they just walked into a luxury salon. Reference their specific features and name.`;

  // ── Call Groq ──────────────────────────────────────────────────────────────
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
        temperature:     0.88,
        max_tokens:      700,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text();
      console.error('Groq error:', errBody);
      return res.status(502).json({ error: 'AI stylist is temporarily unavailable. Try again!' });
    }

    const groqData = await groqResponse.json();
    const rawText  = groqData.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('JSON parse error. Raw:', rawText);
      return res.status(502).json({ error: 'AI response could not be parsed. Try again!' });
    }

    if (!parsed.compliment || !Array.isArray(parsed.products)) {
      return res.status(502).json({ error: 'Incomplete AI response. Try again!' });
    }

    parsed.products = parsed.products.slice(0, 3);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Stylist API error:', err);
    return res.status(500).json({ error: 'Server error. Please try again in a moment.' });
  }
}

// ── Hyper-local location context ──────────────────────────────────────────
function detectLocation(occasion) {
  const lower = occasion.toLowerCase();

  if (lower.includes('bhopal')) {
    return 'Bhopal, Madhya Pradesh — hot semi-arid climate, high UV index, dry heat. Recommend sweat-proof, long-wear formulas with SPF.';
  }
  if (lower.includes('mumbai') || lower.includes('bombay')) {
    return 'Mumbai — high humidity, coastal city. Recommend oil-control, humidity-resistant formulas.';
  }
  if (lower.includes('delhi')) {
    return 'Delhi — extreme temperature swings, pollution. Recommend protective SPF + antioxidant serums.';
  }
  if (lower.includes('bangalore') || lower.includes('bengaluru')) {
    return 'Bengaluru — mild weather, moderate humidity. Lightweight formulas work well year-round.';
  }
  if (lower.includes('kolkata') || lower.includes('calcutta')) {
    return 'Kolkata — tropical humid climate. Recommend mattifying primers and waterproof formulas.';
  }
  if (lower.includes('hyderabad')) {
    return 'Hyderabad — hot and semi-arid. Recommend long-wear foundations with SPF 50+ protection.';
  }
  if (lower.includes('chennai') || lower.includes('madras')) {
    return 'Chennai — very hot and humid. Recommend oil-free, breathable formulas with UV protection.';
  }

  // Default to Bhopal context as specified
  return 'Bhopal, Madhya Pradesh (default context) — hot dry climate with high UV. Recommend sweat-proof formulas with SPF 50.';
}

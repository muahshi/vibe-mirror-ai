# ✦ Vibe Mirror AI

> Privacy-First AI Beauty Stylist — Face data never leaves your browser.

## Architecture

```
Browser (MediaPipe Face Mesh)
  → 468 numerical landmarks only (NO image upload)
  → POST /api/stylist { faceData: {shape, ratios}, occasion }
  → Vercel Function → Groq API (llama-3.3-70b, ~200ms)
  → JSON { compliment, vibeScore, products[], tip }
  → Render affiliate product cards
```

## Deploy in 3 Steps

### 1. GitHub
```bash
git init
git add .
git commit -m "feat: vibe mirror ai initial"
git remote add origin https://github.com/YOUR_USERNAME/vibe-mirror-ai.git
git push -u origin main
```

### 2. Vercel — Add Environment Variable
Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

| Key | Value |
|-----|-------|
| `GROQ_API_KEY` | `gsk_xxxxxxxxxxxx` (get from console.groq.com) |

> ⚠️ NEVER put this key in any HTML/JS file. Vercel env vars only.

### 3. Deploy
Connect GitHub repo to Vercel → Auto-deploys on every push.

## File Structure

```
vibe-mirror-ai/
├── index.html          ← Camera + UI
├── script.js           ← MediaPipe + fetch logic
├── api/
│   └── stylist.js      ← Vercel serverless (Groq call)
├── vercel.json         ← Routing config
└── package.json
```

## Affiliate Setup

Edit `buildAffiliateSearch()` in `script.js`:
- Amazon: Replace `vibemirror-21` with your Amazon Associate tag
- Nykaa: Apply at nykaa.com/affiliate-program
- Myntra: Apply at myntra.com/affiliates

## Privacy Promise

- MediaPipe runs **100% in-browser** (WebAssembly)  
- Only numerical ratios (faceShape, eyeSpacing, etc.) go to API  
- No face images stored anywhere  
- DPDP Act / GDPR compliant by design


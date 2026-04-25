/**
 * VibeMirror AI — script.js v2
 * Premium consumer-grade experience
 * Privacy: Face image NEVER leaves browser. Only numerical data sent.
 */

// ── DOM ───────────────────────────────────────────────────────────────────
const videoEl       = document.getElementById('videoEl');
const arCanvas      = document.getElementById('arCanvas');
const ctx           = arCanvas.getContext('2d');
const hypeBtn       = document.getElementById('hypeBtn');
const occasionInput = document.getElementById('occasionInput');
const camPlaceholder= document.getElementById('camPlaceholder');
const arGuidePill   = document.getElementById('arGuidePill');
const vibeNum       = document.getElementById('vibeNum');
const vibeBar       = document.getElementById('vibeBar');
const complimentEl  = document.getElementById('complimentEl');
const productsScroll= document.getElementById('productsScroll');
const locationBadge = document.getElementById('locationBadge');
const soundBtn      = document.getElementById('soundBtn');
const statScans     = document.getElementById('statScans');

// ── State ─────────────────────────────────────────────────────────────────
let latestLandmarks = null;
let scanCount       = parseInt(localStorage.getItem('vm_scans') || '0');
let smoothScore     = 0;
let animFrame       = null;
let speechEnabled   = true;

statScans.textContent = scanCount;

// ── MediaPipe ─────────────────────────────────────────────────────────────
const faceMesh = new FaceMesh({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.55,
  minTrackingConfidence: 0.55,
});

faceMesh.onResults(onResults);

// ── Camera ────────────────────────────────────────────────────────────────
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    videoEl.srcObject = stream;
    videoEl.onloadedmetadata = () => {
      camPlaceholder.classList.add('hidden');
      arGuidePill.classList.add('visible');
      resizeCanvas();
      runLoop();
    };
  } catch (e) {
    camPlaceholder.querySelector('p').textContent =
      'Camera access denied. Please allow camera and refresh.';
  }
}

function resizeCanvas() {
  arCanvas.width  = videoEl.videoWidth  || 640;
  arCanvas.height = videoEl.videoHeight || 480;
}

async function runLoop() {
  if (videoEl.readyState >= 2) {
    await faceMesh.send({ image: videoEl });
  }
  animFrame = requestAnimationFrame(runLoop);
}

// ── MediaPipe Results ─────────────────────────────────────────────────────
function onResults(results) {
  ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);

  if (results.multiFaceLandmarks?.length) {
    latestLandmarks = results.multiFaceLandmarks[0];
    hypeBtn.disabled = false;
    drawAR(latestLandmarks);
    updateVibeScore(latestLandmarks);
  } else {
    latestLandmarks  = null;
    hypeBtn.disabled = true;
    // Fade score
    smoothScore = Math.max(0, smoothScore - 0.3);
    vibeNum.textContent = smoothScore > 5 ? Math.round(smoothScore) : '—';
    vibeBar.style.width  = smoothScore + '%';
  }
}

// ── AR Drawing ────────────────────────────────────────────────────────────
const OVAL_IDX = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const L_EYE    = [33,160,158,133,153,144];
const R_EYE    = [362,385,387,263,373,380];
const LIPS     = [61,84,17,314,291,409,270,269,267,0,37,39,40,185,61];
const L_BROW   = [70,63,105,66,107];
const R_BROW   = [300,293,334,296,336];
const NOSE_TIP = 1;
const CHEEK_L  = 234;
const CHEEK_R  = 454;

function lmPx(lm, idx, w, h) {
  return [lm[idx].x * w, lm[idx].y * h];
}

function drawAR(lm) {
  const W = arCanvas.width, H = arCanvas.height;

  // Face oval — warm gold contour guide line
  ctx.strokeStyle = 'rgba(212,169,100,0.55)';
  ctx.lineWidth   = 1.8;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  OVAL_IDX.forEach((idx, i) => {
    const [x,y] = lmPx(lm, idx, W, H);
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Eye arcs — lilac
  drawClosedLine(lm, L_EYE, W, H, 'rgba(196,168,212,0.7)', 1.5);
  drawClosedLine(lm, R_EYE, W, H, 'rgba(196,168,212,0.7)', 1.5);

  // Brows — subtle gold
  drawOpenLine(lm, L_BROW, W, H, 'rgba(200,155,80,0.5)', 1.5);
  drawOpenLine(lm, R_BROW, W, H, 'rgba(200,155,80,0.5)', 1.5);

  // Lips — rose pink
  drawClosedLine(lm, LIPS, W, H, 'rgba(212,117,107,0.6)', 1.5);

  // Cheekbone highlight dots
  for (const idx of [CHEEK_L, CHEEK_R, NOSE_TIP]) {
    const [x,y] = lmPx(lm, idx, W, H);
    // Glow ring
    const grad = ctx.createRadialGradient(x,y,0, x,y,14);
    grad.addColorStop(0, 'rgba(212,169,100,0.35)');
    grad.addColorStop(1, 'rgba(212,169,100,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI*2);
    ctx.fill();

    // Center dot
    ctx.fillStyle = 'rgba(212,169,100,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawClosedLine(lm, indices, W, H, color, lw) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  indices.forEach((idx,i) => {
    const [x,y] = lmPx(lm, idx, W, H);
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.closePath(); ctx.stroke();
}

function drawOpenLine(lm, indices, W, H, color, lw) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  indices.forEach((idx,i) => {
    const [x,y] = lmPx(lm, idx, W, H);
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();
}

// ── Live Vibe Score ───────────────────────────────────────────────────────
function updateVibeScore(lm) {
  const faceL    = lm[234], faceR = lm[454];
  const faceW    = Math.abs(faceR.x - faceL.x);
  const center   = (faceL.x + faceR.x) / 2;
  const symmetry = Math.max(0, 1 - Math.abs(lm[NOSE_TIP].x - center) * 5);
  const target   = 68 + symmetry * 28; // range 68–96

  // Smooth
  smoothScore += (target - smoothScore) * 0.04;
  const display = Math.round(smoothScore);

  vibeNum.textContent = display;
  vibeBar.style.width = display + '%';
}

// ── Extract Anonymous Data ────────────────────────────────────────────────
function extractAnonymousData(lm) {
  const W = arCanvas.width, H = arCanvas.height;

  const faceW = Math.abs(lm[454].x - lm[234].x) * W;
  const faceH = Math.abs(lm[152].y - lm[10].y)  * H;
  const eyeD  = Math.abs(lm[263].x - lm[33].x)  * W;
  const lipH  = Math.abs(lm[17].y  - lm[0].y)   * H;
  const jawW  = Math.abs(lm[397].x - lm[172].x)  * W;
  const noseW = Math.abs(lm[358].x - lm[129].x)  * W;

  const ratio = faceW / (faceH || 1);
  let faceShape = 'oval';
  if (ratio < 0.78)        faceShape = 'oblong';
  else if (ratio > 0.95)   faceShape = 'round';
  else if ((jawW/faceW) < 0.7) faceShape = 'heart';

  const sym    = Math.max(0, 1 - Math.abs(lm[1].x - (lm[234].x+lm[454].x)/2)*5);
  const vScore = Math.round(Math.min(96, 68 + sym*28));

  return {
    faceShape,
    vibeScore: vScore,
    ratios: {
      faceAspect:  +(faceW/faceH).toFixed(3),
      eyeSpacing:  +(eyeD/faceW).toFixed(3),
      lipFullness: +(lipH/faceH).toFixed(3),
      jawToFace:   +(jawW/faceW).toFixed(3),
      noseToFace:  +(noseW/faceW).toFixed(3),
    }
  };
}

// ── Hype Button ───────────────────────────────────────────────────────────
hypeBtn.addEventListener('click', async () => {
  if (!latestLandmarks) return;

  const occasion = document.getElementById('occasionInput').value.trim() || 'casual daytime look';
  const faceData = extractAnonymousData(latestLandmarks);

  // Update scan count
  scanCount++;
  localStorage.setItem('vm_scans', scanCount);
  statScans.textContent = scanCount;

  setLoadingState(true);

  try {
    const res = await fetch('/api/stylist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceData, occasion })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    const data = await res.json();
    renderResults(data, faceData, occasion);

  } catch (err) {
    showErrorState(err.message);
  } finally {
    setLoadingState(false);
  }
});

// ── Render Results ────────────────────────────────────────────────────────
const PLATFORM_MAP = {
  'Nykaa':   { cls:'dot-nykaa',   label:'Nykaa',   base:'https://www.nykaa.com/search/result/?q=' },
  'Amazon':  { cls:'dot-amazon',  label:'Amazon',  base:'https://www.amazon.in/s?k=' },
  'Myntra':  { cls:'dot-myntra',  label:'Myntra',  base:'https://www.myntra.com/' },
  'Purplle': { cls:'dot-purplle', label:'Purplle', base:'https://www.purplle.com/search?q=' },
};

function renderResults(data, faceData, occasion) {
  const { compliment, products, tip, vibeScore } = data;

  // Update vibe score
  const vs = vibeScore || faceData.vibeScore;
  vibeNum.textContent  = vs;
  vibeBar.style.width  = vs + '%';
  smoothScore          = vs;

  // Compliment
  complimentEl.innerHTML = `
    <span class="brand-tag">Vibe Mirror AI</span><br/>
    ${escHtml(compliment)}
  `;

  // Location badge
  const loc = extractLocationFromOccasion(occasion);
  if (loc) {
    document.getElementById('locationText').textContent = loc + ' Exclusive Offer';
    locationBadge.style.display = 'inline-flex';
  }

  // Products
  if (products?.length) {
    productsScroll.style.display = 'flex';
    productsScroll.innerHTML = products.map(p => buildProductCard(p)).join('');
  }

  // Speak compliment
  if (speechEnabled && 'speechSynthesis' in window) {
    const utt = new SpeechSynthesisUtterance(compliment);
    utt.lang  = 'en-IN';
    utt.rate  = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }

  showToast('✨ Look generated!');
}

function extractLocationFromOccasion(occ) {
  const lower = occ.toLowerCase();
  if (lower.includes('bhopal'))  return 'Bhopal';
  if (lower.includes('delhi'))   return 'Delhi';
  if (lower.includes('mumbai'))  return 'Mumbai';
  if (lower.includes('bangalore') || lower.includes('bengaluru')) return 'Bangalore';
  return null;
}

function buildProductCard(p) {
  const platform = p.platform || 'Nykaa';
  const pm       = PLATFORM_MAP[platform] || PLATFORM_MAP['Nykaa'];
  const url      = p.affiliateUrl || (pm.base + encodeURIComponent(p.name));
  const emoji    = p.emoji || '✨';
  const parts    = p.name.split(' ');
  const brand    = parts.slice(0,2).join(' ');
  const name     = parts.slice(2).join(' ') || p.name;

  return `
    <div class="product-card" onclick="window.open('${escHtml(url)}','_blank')">
      <div class="product-img-area">
        <span>${emoji}</span>
        <span class="product-platform-dot ${pm.cls}">${pm.label}</span>
      </div>
      <div class="product-body">
        <div class="product-brand">${escHtml(brand)}</div>
        <div class="product-name">${escHtml(name)}</div>
        <div class="product-shade">${escHtml(p.description || '')}</div>
        <div class="product-price">₹${p.price || '—'}</div>
        <button class="shop-btn">Shop Now →</button>
      </div>
    </div>
  `;
}

function showErrorState(msg) {
  complimentEl.innerHTML = `<span style="color:rgba(220,100,80,0.9);font-size:0.82rem">
    ⚠ ${escHtml(msg)}<br/>
    <span style="font-size:0.75rem;opacity:0.7">Check GROQ_API_KEY in Vercel env variables</span>
  </span>`;
}

// ── UI Helpers ────────────────────────────────────────────────────────────
function setLoadingState(loading) {
  hypeBtn.disabled  = loading;
  hypeBtn.innerHTML = loading
    ? `<span class="shimmer"></span><span class="btn-spinner"></span> Analyzing your vibe...`
    : `<span class="shimmer"></span>✦ Hype Me Up`;
}

function escHtml(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Sound toggle
soundBtn.addEventListener('click', () => {
  speechEnabled = !speechEnabled;
  soundBtn.textContent = speechEnabled ? '🔊' : '🔇';
  showToast(speechEnabled ? 'Voice hype ON 🔊' : 'Voice hype OFF 🔇');
});

// ── Boot ──────────────────────────────────────────────────────────────────
initCamera();

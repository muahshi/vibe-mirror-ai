/**
 * Vibe Mirror AI — script.js v5.0 FINAL
 * ─────────────────────────────────────
 * ✅ Cormorant Garamond luxury aesthetic
 * ✅ MediaPipe face mesh (unchanged core)
 * ✅ Digital Skeleton: gold brows, cyan eyes, rose lips, cheekbone arcs
 * ✅ Dynamic aura glow follows head movement
 * ✅ Studio flash on scan (0.5s white screen)
 * ✅ Web Speech API — 4 voice modes (Sweet/Pro/Deep/Calm)
 * ✅ Greeting: "Hello [Name], you look absolutely stunning today."
 * ✅ Symmetry always 91–98% (psychological boost)
 * ✅ Gamification: streak, glow coins (+20/scan)
 * ✅ Hyper-local Bhopal context
 * ✅ localStorage persistence
 * ✅ Brand: Vibe Mirror AI everywhere
 */

// ── DOM REFS ──────────────────────────────────────────────────────────────
const videoEl    = document.getElementById('videoEl');
const arCanvas   = document.getElementById('arCanvas');
const auraCanvas = document.getElementById('auraCanvas');
const ctx        = arCanvas.getContext('2d');
const auraCtx    = auraCanvas.getContext('2d');
const scanBtn    = document.getElementById('scanBtn');
const occInput   = document.getElementById('occasionInput');
const camPH      = document.getElementById('camPlaceholder');
const arPill     = document.getElementById('arGuidePill');
const vibeNum    = document.getElementById('vibeNum');
const vibeBar    = document.getElementById('vibeBar');
const compTitle  = document.getElementById('compTitle');
const compSub    = document.getElementById('compSub');
const prodsRow   = document.getElementById('prodsRow');
const flashEl    = document.getElementById('flash');
const streakEl   = document.getElementById('streakVal');
const coinsEl    = document.getElementById('coinsVal');
const symChip    = document.getElementById('symChip');

// ── USER PROFILE ──────────────────────────────────────────────────────────
const STORE = 'vm_profile_v3';

function loadUP() {
  try { const r = localStorage.getItem(STORE); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveUP() {
  try { localStorage.setItem(STORE, JSON.stringify(UP)); } catch {}
}

// expose globally so inline HTML handlers can write to it
window.UP = loadUP() || {
  name: '', gender: 'female', voice: 'sweet', goal: 'Radiant Glow',
  scanCount: 0, glowCoins: 0, streak: 1, lastDate: null, done: false
};
const UP = window.UP;

// ── ONBOARDING ────────────────────────────────────────────────────────────
window.finishOB = function () {
  const n = document.getElementById('nameInput').value.trim();
  if (n) UP.name = n;
  UP.done = true;
  saveUP();
  launchApp();
};

window.skipOB = function () {
  UP.done = true;
  saveUP();
  launchApp();
};

function launchApp() {
  document.getElementById('onboardScreen').classList.remove('active');
  document.getElementById('mirrorScreen').classList.add('active');
  document.getElementById('bottomNav').style.display = 'flex';
  syncGamebar();
  updateProfileUI();
  initFaceMesh();
  initCamera();

  // Personalised greeting after short delay
  setTimeout(() => {
    const n = UP.name ? UP.name : 'beautiful';
    speakText(`Hello ${n}, you look absolutely stunning today. Let's analyse your glow.`);
  }, 1200);
}

window.addEventListener('DOMContentLoaded', () => {
  if (UP.done) {
    document.getElementById('onboardScreen').classList.remove('active');
    document.getElementById('mirrorScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';
    syncGamebar();
    updateProfileUI();
    initFaceMesh();
    initCamera();

    setTimeout(() => {
      const n = UP.name ? UP.name : 'beautiful';
      speakText(`Welcome back, ${n}. Your mirror is ready.`);
    }, 1400);
  } else {
    document.getElementById('bottomNav').style.display = 'none';
  }
});

// ── GAMIFICATION ──────────────────────────────────────────────────────────
function syncGamebar() {
  streakEl.textContent = UP.streak || 1;
  coinsEl.textContent  = UP.glowCoins || 0;
}

function updateProfileUI() {
  const sc = document.getElementById('profScore');
  if (sc && lastScore > 0) sc.textContent = lastScore;
  const av = document.getElementById('profAv');
  if (av && UP.name) av.textContent = UP.name[0].toUpperCase();
}

function awardCoins(n) {
  UP.glowCoins = (UP.glowCoins || 0) + n;
  syncGamebar();
  saveUP();
  showToast(`⭐ +${n} Glow Coins earned!`);
}

function bumpStreak() {
  const today = new Date().toDateString();
  if (UP.lastDate !== today) {
    const yest = new Date(Date.now() - 86400000).toDateString();
    UP.streak = UP.lastDate === yest ? (UP.streak || 1) + 1 : 1;
    UP.lastDate = today;
    syncGamebar();
    saveUP();
  }
}

// ── MEDIAPIPE + CAMERA ───────────────────────────────────────────────────
// faceMesh initialized lazily so it doesn't crash if CDN loads slow
let faceMesh = null;
let _loopRunning = false;

function initFaceMesh(cb) {
  // Wait until FaceMesh class is available (CDN may still be loading)
  if (typeof FaceMesh === 'undefined') {
    setTimeout(() => initFaceMesh(cb), 200);
    return;
  }
  try {
    faceMesh = new FaceMesh({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
    });
    faceMesh.setOptions({
      maxNumFaces: 1, refineLandmarks: true,
      minDetectionConfidence: 0.55, minTrackingConfidence: 0.55
    });
    faceMesh.onResults(onResults);
    if (cb) cb();
  } catch(e) {
    console.warn('FaceMesh init error:', e);
    setTimeout(() => initFaceMesh(cb), 500);
  }
}

async function initCamera() {
  try {
    // Try front camera with fallback
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    videoEl.srcObject = stream;

    const onReady = () => {
      videoEl.play().catch(() => {});
      camPH.classList.add('hidden');
      arPill.classList.add('visible');
      resizeC();
      scanBtn.disabled = false;
      if (!_loopRunning) { _loopRunning = true; loop(); }
    };

    videoEl.onloadedmetadata = onReady;

    // Android fallback: onloadedmetadata sometimes never fires
    setTimeout(() => {
      if (videoEl.readyState >= 1) onReady();
    }, 2000);

  } catch(err) {
    const msg = err.name === 'NotAllowedError'
      ? '🔒 Camera blocked — tap the lock icon in address bar and allow camera'
      : '📷 Camera error: ' + err.name + '. Please refresh.';
    camPH.querySelector('p').textContent = msg;
  }
}

function resizeC() {
  const W = videoEl.videoWidth  || 640;
  const H = videoEl.videoHeight || 480;
  arCanvas.width = auraCanvas.width  = W;
  arCanvas.height= auraCanvas.height = H;
}

async function loop() {
  if (videoEl.readyState >= 2 && faceMesh) {
    try { await faceMesh.send({ image: videoEl }); } catch {}
  }
  requestAnimationFrame(loop);
}

// ── RUNTIME STATE ─────────────────────────────────────────────────────────
let latestLM   = null;
let smoothScore= 0;
let smoothSym  = 94;
let auraAngle  = 0;
let auraX      = 0, auraY = 0;
let soundOn    = true;
let lastScore  = 0;

// ── MEDIAPIPE RESULTS ─────────────────────────────────────────────────────
function onResults(res) {
  ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
  auraCtx.clearRect(0, 0, auraCanvas.width, auraCanvas.height);

  if (res.multiFaceLandmarks?.length) {
    latestLM = res.multiFaceLandmarks[0];
    scanBtn.disabled = false;
    drawAura(latestLM);
    drawSkeleton(latestLM);
    liveScore(latestLM);
  } else {
    latestLM = null;
    smoothScore = Math.max(0, smoothScore - 0.5);
    if (smoothScore < 5) { vibeNum.textContent = '—'; vibeBar.style.width = '0%'; }
    else { vibeNum.textContent = Math.round(smoothScore); vibeBar.style.width = smoothScore + '%'; }
  }
}

// ── DYNAMIC GOLDEN AURA ───────────────────────────────────────────────────
function drawAura(lm) {
  const W = auraCanvas.width, H = auraCanvas.height;
  const nose = lm[1];
  const tx = nose.x * W, ty = nose.y * H;

  // Smooth follow
  auraX += (tx - auraX) * 0.07;
  auraY += (ty - auraY) * 0.07;
  auraAngle += 0.011;

  const faceW = Math.abs(lm[454].x - lm[234].x) * W;
  const r = faceW * 0.82;
  const cy = auraY - r * 0.28;

  // Soft golden halo
  const grd = auraCtx.createRadialGradient(auraX, cy, 0, auraX, cy, r * 1.52);
  grd.addColorStop(0,   'rgba(229,177,161,0.18)');
  grd.addColorStop(0.45,'rgba(229,177,161,0.07)');
  grd.addColorStop(1,   'rgba(229,177,161,0)');
  auraCtx.fillStyle = grd;
  auraCtx.beginPath();
  auraCtx.ellipse(auraX, cy, r * 1.52, r * 1.88, 0, 0, Math.PI * 2);
  auraCtx.fill();

  // 3 rotating gold sparks
  for (let i = 0; i < 3; i++) {
    const a = auraAngle + (i * Math.PI * 2) / 3;
    const sx = auraX + Math.cos(a) * r * 0.54;
    const sy = cy       + Math.sin(a) * r * 0.40;
    const sg = auraCtx.createRadialGradient(sx, sy, 0, sx, sy, 22);
    sg.addColorStop(0, 'rgba(229,177,161,0.52)');
    sg.addColorStop(1, 'rgba(229,177,161,0)');
    auraCtx.fillStyle = sg;
    auraCtx.beginPath();
    auraCtx.arc(sx, sy, 22, 0, Math.PI * 2);
    auraCtx.fill();
  }
}

// ── DIGITAL SKELETON ──────────────────────────────────────────────────────
// Landmark index groups
const I_OVAL  = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const I_LEYE  = [33,160,158,133,153,144];
const I_REYE  = [362,385,387,263,373,380];
const I_LBROW = [70,63,105,66,107,55,65,52,53,46];
const I_RBROW = [300,293,334,296,336,285,295,282,283,276];
const I_NOSE  = [168,6,197,195,5,4,1,19,94,2];
const I_LIPS  = [61,84,17,314,291,409,270,269,267,0,37,39,40,185];
const I_LIPSI = [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];

function P(lm, i, W, H) { return [lm[i].x * W, lm[i].y * H]; }

function polyO(lm, idx, W, H, col, lw, dash = []) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
  ctx.beginPath();
  idx.forEach((i, n) => { const [x, y] = P(lm, i, W, H); n === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke(); ctx.setLineDash([]);
}

function polyC(lm, idx, W, H, col, lw, dash = []) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
  ctx.beginPath();
  idx.forEach((i, n) => { const [x, y] = P(lm, i, W, H); n === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
}

function gDot(x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col.replace('1)', '0.75)'));
  g.addColorStop(1, col.replace('1)', '0)'));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // bright center dot
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
}

function fillPoly(lm, idx, W, H, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  idx.forEach((i, n) => { const [x, y] = P(lm, i, W, H); n === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.closePath(); ctx.fill();
}

function drawSkeleton(lm) {
  const W = arCanvas.width, H = arCanvas.height;

  // 1. Face oval — gold dashed
  polyC(lm, I_OVAL, W, H, 'rgba(229,177,161,0.48)', 1.4, [4, 6]);

  // 2. Eyebrows — solid bright gold (key feature)
  polyO(lm, I_LBROW, W, H, 'rgba(229,177,161,0.95)', 2.2);
  polyO(lm, I_RBROW, W, H, 'rgba(229,177,161,0.95)', 2.2);

  // 3. Eyes — cyan closed polygon
  polyC(lm, I_LEYE, W, H, 'rgba(180,225,255,0.88)', 1.8);
  polyC(lm, I_REYE, W, H, 'rgba(180,225,255,0.88)', 1.8);

  // 4. Eye fill — subtle cyan glow
  fillPoly(lm, I_LEYE, W, H, 'rgba(99,247,255,0.08)');
  fillPoly(lm, I_REYE, W, H, 'rgba(99,247,255,0.08)');

  // 5. Eyeliner coach dotted overlay
  polyO(lm, I_LEYE, W, H, 'rgba(99,247,255,0.45)', 1.0, [2, 4]);
  polyO(lm, I_REYE, W, H, 'rgba(99,247,255,0.45)', 1.0, [2, 4]);

  // 6. Nose bridge — subtle white
  polyO(lm, I_NOSE, W, H, 'rgba(255,255,255,0.2)', 0.9);

  // 7. Cheekbone contour curves (from reference image 1 & 3)
  const [clx, cly] = P(lm, 234, W, H);
  const [crx, cry] = P(lm, 454, W, H);
  const [nx,  ny]  = P(lm, 4,   W, H);
  const [chinx, chiny] = P(lm, 152, W, H);

  ctx.strokeStyle = 'rgba(229,177,161,0.7)';
  ctx.lineWidth   = 1.9;
  ctx.setLineDash([]);

  // Left cheekbone arc
  ctx.beginPath();
  ctx.moveTo(clx + (nx - clx) * 0.28, cly + (ny - cly) * 0.62);
  ctx.quadraticCurveTo(
    clx + (nx - clx) * 0.12, cly + (chiny - cly) * 0.52,
    chinx + (clx - chinx) * 0.36, chiny - (chiny - cly) * 0.1
  );
  ctx.stroke();

  // Right cheekbone arc
  ctx.beginPath();
  ctx.moveTo(crx + (nx - crx) * 0.28, cry + (ny - cry) * 0.62);
  ctx.quadraticCurveTo(
    crx + (nx - crx) * 0.12, cry + (chiny - cry) * 0.52,
    chinx + (crx - chinx) * 0.36, chiny - (chiny - cry) * 0.1
  );
  ctx.stroke();

  // 8. Lips outer — rose/coral
  polyC(lm, I_LIPS,  W, H, 'rgba(210,100,90,0.88)', 1.9);

  // 9. Lips inner — dotted coach overlay
  polyC(lm, I_LIPSI, W, H, 'rgba(255,140,120,0.52)', 1.1, [2, 3]);

  // 10. Lip subtle fill
  fillPoly(lm, I_LIPS, W, H, 'rgba(210,80,70,0.09)');

  // 11. Golden ratio horizontal guide lines
  const fL = lm[234].x * W - 18;
  const fR = lm[454].x * W + 18;
  const ratioY = [lm[10].y * H, lm[66].y * H, lm[4].y * H, lm[17].y * H, lm[152].y * H];
  ctx.strokeStyle = 'rgba(229,177,161,0.2)';
  ctx.lineWidth = 0.8; ctx.setLineDash([5, 8]);
  ratioY.forEach(y => { ctx.beginPath(); ctx.moveTo(fL, y); ctx.lineTo(fR, y); ctx.stroke(); });
  ctx.setLineDash([]);

  // 12. Glow dots — cheekbones, nose, lip corners
  gDot(...P(lm, 234, W, H), 17, 'rgba(229,177,161,1)');
  gDot(...P(lm, 454, W, H), 17, 'rgba(229,177,161,1)');
  gDot(...P(lm, 1,   W, H), 11, 'rgba(229,177,161,1)');
  gDot(...P(lm, 61,  W, H), 10, 'rgba(210,100,90,1)');
  gDot(...P(lm, 291, W, H), 10, 'rgba(210,100,90,1)');

  // 13. Micro white dots on skeleton intersections
  [10, 152, 107, 336, 33, 263, 1, 61, 291].forEach(i => {
    const [x, y] = P(lm, i, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  });
}

// ── LIVE SCORE ────────────────────────────────────────────────────────────
function liveScore(lm) {
  const cx  = (lm[234].x + lm[454].x) / 2;
  const sym = Math.max(0, 1 - Math.abs(lm[1].x - cx) * 5);
  const target = 72 + sym * 24;
  smoothScore += (target - smoothScore) * 0.04;

  const disp = Math.round(smoothScore);
  vibeNum.textContent = disp;
  vibeBar.style.width = disp + '%';
  lastScore = disp;

  // Symmetry: psychological boost 91–98%
  const rawSym = 91 + sym * 7;
  smoothSym += (rawSym - smoothSym) * 0.05;
  symChip.textContent = '◈ ' + Math.min(98, Math.max(91, Math.round(smoothSym))) + '%';
}

// ── STUDIO FLASH ─────────────────────────────────────────────────────────
window.triggerFlash = function () {
  flashEl.style.transition = 'opacity 0.06s ease';
  flashEl.style.opacity = '1';
  setTimeout(() => {
    flashEl.style.transition = 'opacity 0.5s ease';
    flashEl.style.opacity = '0';
  }, 180);
};

// ── SCAN ─────────────────────────────────────────────────────────────────
window.doScan = async function () {
  if (!latestLM) { showToast('🔍 Point your face at the camera first!'); return; }

  // STUDIO FLASH before scan
  triggerFlash();

  const occ = occInput.value.trim() || `${UP.goal || 'daily glow'} in Bhopal`;
  const fd  = extractData(latestLM);

  // Inject wardrobe context — AI will use owned products first
  const wardrobeStr = getWardrobeString ? getWardrobeString() : '';
  const fullOccasion = occ + (wardrobeStr ? ' · ' + wardrobeStr : '');

  UP.scanCount = (UP.scanCount || 0) + 1;
  bumpStreak();
  saveUP();

  setLoading(true);
  try {
    const res = await fetch('/api/stylist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceData: fd, occasion: fullOccasion })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Error ${res.status}`); }
    const data = await res.json();
    renderResult(data, fd);
    awardCoins(20);
  } catch (e) {
    compSub.textContent = '⚠ ' + (e.message || 'Check GROQ_API_KEY in Vercel env.');
  } finally {
    setLoading(false);
  }
};

// ── EXTRACT ANONYMOUS DATA ────────────────────────────────────────────────
function extractData(lm) {
  const W = arCanvas.width, H = arCanvas.height;
  const fW = Math.abs(lm[454].x - lm[234].x) * W;
  const fH = Math.abs(lm[152].y - lm[10].y)  * H;
  const eD = Math.abs(lm[263].x - lm[33].x)  * W;
  const lH = Math.abs(lm[17].y  - lm[0].y)   * H;
  const jW = Math.abs(lm[397].x - lm[172].x)  * W;
  const r  = fW / (fH || 1);
  const shape = r < 0.78 ? 'oblong' : r > 0.95 ? 'round' : (jW / fW) < 0.72 ? 'heart' : 'oval';
  const cx  = (lm[234].x + lm[454].x) / 2;
  const sym = Math.max(0, 1 - Math.abs(lm[1].x - cx) * 5);
  return {
    faceShape: shape,
    vibeScore: Math.round(Math.min(96, 72 + sym * 24)),
    symmetryScore: Math.min(98, Math.max(91, Math.round(91 + sym * 7))),
    userName: UP.name || 'Beautiful',
    goal: UP.goal || 'Radiant Glow',
    ratios: {
      faceAspect:  +(fW / fH).toFixed(3),
      eyeSpacing:  +(eD / fW).toFixed(3),
      lipFullness: +(lH / fH).toFixed(3),
      jawToFace:   +(jW / fW).toFixed(3),
    }
  };
}

// ── RENDER RESULTS ────────────────────────────────────────────────────────
const PLT = {
  'Nykaa':   { cls: 'p-nykaa',   lbl: 'Nykaa',   base: 'https://www.nykaa.com/search/result/?q=' },
  'Amazon':  { cls: 'p-amazon',  lbl: 'Amazon',  base: 'https://www.amazon.in/s?k=' },
  'Myntra':  { cls: 'p-myntra',  lbl: 'Myntra',  base: 'https://www.myntra.com/' },
  'Purplle': { cls: 'p-purplle', lbl: 'Purplle', base: 'https://www.purplle.com/search?q=' },
};

function renderResult(data, fd) {
  const { compliment, products, vibeScore } = data;
  const vs = vibeScore || fd.vibeScore;

  vibeNum.textContent = vs;
  vibeBar.style.width = vs + '%';
  smoothScore = vs; lastScore = vs;

  const prefix = UP.name ? `${UP.name}, ` : '';
  const full   = prefix + compliment;

  // Update compliment card
  compTitle.textContent = `"${compliment.slice(0, 55)}${compliment.length > 55 ? '…' : ''}"`;
  compSub.textContent   = `Vibe AI Analysis · ${fd.faceShape} face · Symmetry ${fd.symmetryScore}%`;

  // Update profile score
  const ps = document.getElementById('profScore');
  if (ps) ps.textContent = vs;
  updateProfileUI();

  // Products
  if (products?.length) {
    prodsRow.style.display = 'flex';
    prodsRow.innerHTML = products.slice(0, 3).map(p => {
      const pm  = PLT[p.platform] || PLT['Nykaa'];
      const url = p.affiliateUrl || (pm.base + encodeURIComponent(p.name));
      const parts = p.name.split(' ');
      const br  = parts.slice(0, 2).join(' ');
      const nm  = parts.slice(2).join(' ') || p.name;
      return `
        <div class="pcard" onclick="window.open('${esc(url)}','_blank')">
          <div class="pimg">
            <span>${p.emoji || '✨'}</span>
            <span class="pplatform ${pm.cls}">${pm.lbl}</span>
          </div>
          <div class="pbody">
            <div class="pbrand">${esc(br)}</div>
            <div class="pname">${esc(nm)}</div>
            <div class="pdesc">${esc(p.description || '')}</div>
            <div class="pprice">₹${p.price || '—'}</div>
            <button class="pbtn">Shop Now →</button>
          </div>
        </div>`;
    }).join('');
  }

  // Voice hype
  if (soundOn) {
    const n = UP.name ? UP.name : '';
    speakText((n ? n + ', ' : '') + compliment);
  }

  showToast('✨ Vibe Mirror AI analysis complete!');
}

function setLoading(on) {
  scanBtn.disabled = on;
  scanBtn.innerHTML = on
    ? `<span class="btn-spin"></span> Analyzing…`
    : `<span class="material-symbols-outlined ms" style="font-family:'Material Symbols Outlined';font-size:18px">center_focus_weak</span> Scan Skin`;
}

// ── VOICE ENGINE ──────────────────────────────────────────────────────────
let voices = [];

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  if (!voices.length) setTimeout(loadVoices, 250);
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function getBestVoice() {
  if (!voices.length) voices = window.speechSynthesis.getVoices();
  const v = UP.voice || 'sweet';
  const isFemale = (v === 'sweet' || v === 'calm');
  const en = voices.filter(v => v.lang.startsWith('en'));
  const indian = en.filter(v => v.name.includes('India') || v.name.includes('IN'));

  if (isFemale) {
    return (
      indian.find(v => v.name.includes('Aditi') || v.name.includes('Raveena')) ||
      en.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Moira') || v.name.includes('Tessa')) ||
      en[0] || null
    );
  } else {
    return (
      indian.find(v => !v.name.toLowerCase().includes('female')) ||
      en.find(v => v.name.includes('Daniel') || v.name.includes('Tom') || v.name.includes('Aaron') || v.name.includes('Oliver')) ||
      en[1] || null
    );
  }
}

function getVoiceParams() {
  const v = UP.voice || 'sweet';
  switch (v) {
    case 'sweet': return { pitch: 1.14, rate: 0.90 };
    case 'pro':   return { pitch: 0.92, rate: 0.88 };
    case 'deep':  return { pitch: 0.72, rate: 0.83 };
    case 'calm':  return { pitch: 1.02, rate: 0.82 };
    default:      return { pitch: 1.0,  rate: 0.88 };
  }
}

window.speakText = function speakText(text) {
  if (!soundOn || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(text);
  utt.lang    = 'en-IN';
  const voice = getBestVoice();
  if (voice) utt.voice = voice;
  const { pitch, rate } = getVoiceParams();
  utt.pitch  = pitch;
  utt.rate   = rate;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
};

window.toggleSound = function () {
  soundOn = !soundOn;
  const btn = document.getElementById('soundBtn');
  if (btn) btn.querySelector('.ms').textContent = soundOn ? 'volume_up' : 'volume_off';
  showToast(soundOn ? '🔊 Voice hype ON' : '🔇 Voice hype OFF');
  if (!soundOn) window.speechSynthesis.cancel();
};

// ── UTILS ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.showToast = function (msg) {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
};

// ── REAL AI CHAT (Stylist Screen) ─────────────────────────────────────────
let chatHistory = [];
let chatTyping  = false;

window.startChat = function(who) {
  const name = who === 'sarah' ? 'Sarah Jenkins' : 'Vibe Architect AI';
  showToast(`💬 Connected to ${name}`);
  addAIMsg(`Hi! I'm ${name}. How can I help with your beauty routine today? You can ask me about skincare, makeup, or city-specific tips!`);
};

window.sendChat = async function() {
  const inp = document.getElementById('chatInput');
  if (!inp) return;
  const msg = inp.value.trim();
  if (!msg || chatTyping) return;
  inp.value = '';

  addUserMsg(msg);
  chatTyping = true;

  // Add thinking bubble
  const thinkId = 'think_' + Date.now();
  addAIMsg('Analyzing…', thinkId, true);

  try {
    const city = document.getElementById('occasionInput')?.value || 'Bhopal';
    const systemPrompt = `You are Vibe AI, a premium AI beauty stylist for Vibe Mirror AI app.
You specialise in Indian beauty, skincare and makeup. Be warm, specific, and empowering.
User context: Name="${window.UP?.name||'User'}", Goal="${window.UP?.goal||'Radiant Glow'}", City context="${city}".
Keep replies under 80 words. Suggest specific Indian brand products when relevant (Sugar, Nykaa, Mamaearth, Lakme, Dot & Key, Plum, MyGlamm).`;

    chatHistory.push({ role: 'user', content: msg });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (window.GROQ_KEY || '')
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...chatHistory.slice(-6)],
        max_tokens: 200,
        temperature: 0.85
      })
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'I\'d love to help! Could you tell me more about your skin concern?';
    chatHistory.push({ role: 'assistant', content: reply });

    // Replace thinking bubble
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.parentElement.remove();
    addAIMsg(reply);
    if (window.soundOn !== false) speakText(reply);

  } catch (e) {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.parentElement.remove();
    addAIMsg('I\'m having trouble connecting right now. Please check the API configuration and try again!');
  }

  chatTyping = false;
};

function addUserMsg(text) {
  const area = document.getElementById('chatArea');
  if (!area) return;
  const div = document.createElement('div');
  div.className = 'chat-u';
  div.textContent = text;
  area.appendChild(div);
  scrollChat();
}

function addAIMsg(text, id, typing = false) {
  const area = document.getElementById('chatArea');
  if (!area) return;
  const wrap = document.createElement('div');
  wrap.className = 'chat-ai';
  wrap.innerHTML = `
    <div class="chat-ai-av"><span class="material-symbols-outlined ms" style="font-size:14px">auto_awesome</span></div>
    <div class="chat-ai-b" ${id ? `id="${id}"` : ''}>${typing ? '<span class="chat-dots">⋯</span>' : escS(text)}</div>`;
  area.appendChild(wrap);
  scrollChat();
}

function scrollChat() {
  const scroll = document.getElementById('styScroll');
  if (scroll) setTimeout(() => { scroll.scrollTop = scroll.scrollHeight; }, 100);
}

function escS(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Voice input for chat
window.startVoiceInput = function() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    showToast('Voice input not supported on this browser');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'en-IN';
  rec.interimResults = false;
  rec.onresult = (e) => {
    const inp = document.getElementById('chatInput');
    if (inp) inp.value = e.results[0][0].transcript;
  };
  rec.onerror = () => showToast('Voice input failed, try typing');
  rec.start();
  showToast('🎤 Listening…');
};

// ═══════════════════════════════════════════════════════════
//  V6 ADDITIONS — Camera untouched above. Only new features.
// ═══════════════════════════════════════════════════════════

// ── TWO-MODE CAMERA ──────────────────────────────────────────
let _mode = 'glow';

const STEPS = {
  eyes:    'Apply a thin line along upper lash line. Extend at outer corner for cat-eye. Cyan guide shows your exact path.',
  brows:   'Fill sparse areas with light strokes along the golden guide arcs. Start from inner edge, feather outward.',
  contour: 'Blend matte bronzer along the dotted cheek arcs from temple downward. Build gradually.',
  blush:   'Smile and apply blush on the highlighted cheekbone circle. Blend upward toward temples.',
  lips:    'Line just outside natural lip edge along the rose guide. Fill with long-wear lipstick.'
};

window.setMode = function(mode) {
  _mode = mode;
  document.getElementById('modeGlow').classList.toggle('active', mode === 'glow');
  document.getElementById('modeGuide').classList.toggle('active', mode === 'guide');
  const gf = document.getElementById('glowFilter');
  if (gf) gf.style.opacity = mode === 'glow' ? '1' : '0';
  const ms = document.getElementById('makeupSteps');
  if (ms) ms.classList.toggle('show', mode === 'guide');
  showToast(mode === 'glow' ? '✦ Glow Mirror — luxury mode' : '💄 Makeup Guide — select a step');
  speakText(mode === 'glow' ? 'Glow mode on. You look stunning.' : 'Makeup guide mode. Select a step to begin.');
};

window.selStep = function(el, step) {
  document.querySelectorAll('.ms-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const instr = document.getElementById('msInstr');
  if (instr) instr.textContent = STEPS[step] || '';
  speakText(STEPS[step] || '');
};

// ── BEAUTY STATS (update after each scan) ────────────────────
function updateBS(fd) {
  if (!fd) return;
  const b = fd.vibeScore || 80;
  const h = Math.min(99, Math.round(b * 0.88 + 5));
  const g = Math.min(99, Math.round(b * 0.93));
  const s = fd.symmetryScore || Math.min(98, Math.round(91 + (fd.ratios?.eyeSpacing||0.3)*10));
  const t = Math.min(99, Math.round(b * 0.85 + 3));
  const upd = (id, bid, val, did) => {
    const e=document.getElementById(id), b2=document.getElementById(bid), d=document.getElementById(did);
    if(e) e.textContent=val;
    if(b2) b2.style.width=val+'%';
    if(d) d.textContent='+'+Math.round(val*0.08)+'% week';
  };
  upd('bsH','bsHB','bsHD', h); upd('bsG','bsGB','bsGD', g);
  upd('bsS','bsSB','bsSD', s); upd('bsT','bsTB','bsTD', t);
  try {
    let hist = JSON.parse(localStorage.getItem('vm_bs')||'[]');
    hist = hist.filter(x=>x.date!==new Date().toDateString());
    hist.push({date:new Date().toDateString(),h,g,s,t,v:b});
    localStorage.setItem('vm_bs', JSON.stringify(hist.slice(-30)));
  } catch{}
}

// Load saved stats on open
window.addEventListener('DOMContentLoaded', () => {
  try {
    const hist = JSON.parse(localStorage.getItem('vm_bs')||'[]');
    if (hist.length) {
      const last = hist[hist.length-1];
      const upd=(id,bid,val,did)=>{const e=document.getElementById(id),b=document.getElementById(bid),d=document.getElementById(did);if(e)e.textContent=val;if(b)b.style.width=val+'%';if(d)d.textContent='+'+Math.round(val*0.08)+'% week'};
      upd('bsH','bsHB','bsHD',last.h);upd('bsG','bsGB','bsGD',last.g);
      upd('bsS','bsSB','bsSD',last.s);upd('bsT','bsTB','bsTD',last.t);
    }
  } catch{}
  updateCoinBar();
  fetchUV();
});

// ── COIN PROGRESS BAR ────────────────────────────────────────
function updateCoinBar() {
  const coins = UP.glowCoins || 0;
  const n = document.getElementById('cpNum');
  const f = document.getElementById('cpFill');
  if (n) n.textContent = coins;
  if (f) f.style.width = Math.min(100, (coins/100)*100) + '%';
  if (coins >= 100) showToast('🎉 100 Coins reached! PRO unlocked for 30 days!');
}

// ── PATCH renderResult to update beauty stats + coins ────────
const _origRR = window.renderResult || renderResult;
window.renderResult = renderResult = function(data, fd) {
  _origRR(data, fd);
  if (fd) updateBS(fd);
  updateCoinBar();
};

// ── UV / WEATHER ALERT ───────────────────────────────────────
async function fetchUV() {
  try {
    const city = UP.city || 'Bhopal';
    let lat=23.2599, lon=77.4126;
    try {
      const g=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const gd=await g.json();
      if(gd.results?.[0]){lat=gd.results[0].latitude;lon=gd.results[0].longitude;}
    } catch{}
    const w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=uv_index_max&timezone=auto&forecast_days=1`);
    const wd=await w.json();
    const uv=wd.daily?.uv_index_max?.[0]||0;
    const temp=wd.current?.temperature_2m||0;
    const al=document.getElementById('uvAlert');
    const tx=document.getElementById('uvText');
    if(!al||!tx) return;
    if(uv>=6||temp>=33){
      let msg=uv>=8?`<b>🚨 Extreme UV (${uv}) — ${city}</b><br/>Apply SPF 50+ before stepping out!`
        :uv>=6?`<b>☀️ High UV (${uv}) — ${city}</b><br/>Don't skip SPF 50+ today. Your glow needs protection.`
        :`<b>🌡️ ${Math.round(temp)}°C in ${city}</b><br/>Matte, long-wear foundation recommended today.`;
      tx.innerHTML=msg; al.classList.add('show');
      const key='vm_uv_'+new Date().toDateString();
      if(!localStorage.getItem(key)){speakText(tx.innerText.slice(0,80));localStorage.setItem(key,'1');}
    }
  } catch{}
}

// ── IG SHARE +2 COINS ────────────────────────────────────────
window.goShare = async function() {
  const score = lastScore || 88;
  const name = UP.name || 'You';
  const txt = `✨ ${name}'s Vibe Mirror AI Score: ${score}/100!\nAI says I'm absolutely glowing 🔥\nvibemirror.ai`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'My Glow Score 🌟', text: txt });
    } else {
      await navigator.clipboard.writeText(txt);
      showToast('📋 Copied! Paste on Instagram to share.');
    }
    awardCoins(2);
    showToast('🎁 +2 Coins for sharing!');
    updateCoinBar();
  } catch{}
};

// ── SHOPPING BOT ─────────────────────────────────────────────
let _sbotH = [];

window.sbotQ = function(el) { sbotSend(el.textContent.trim()); };

window.sbotSend = async function(msg) {
  const inp = document.getElementById('sbotIn');
  const m = msg || (inp ? inp.value.trim() : '');
  if (!m) return;
  if (inp) inp.value = '';
  _sbotAdd('u', m);
  _sbotH.push({role:'user',content:m});
  const tid = 'st'+Date.now();
  _sbotAddRaw(`<div class="sbot-msg ai" id="${tid}"><div class="sbot-av">🛒</div><div class="sbot-bubble" style="opacity:.5">⋯ thinking</div></div>`);
  try {
    const fd = window.latestLM ? extractData(window.latestLM) : null;
    const r = await fetch('/api/stylist',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'shopping_bot',message:m,faceData:fd||{faceShape:'oval',vibeScore:80},
        occasion:'Shopping assistant. City:'+(UP.city||'Bhopal'),userName:UP.name||'',
        skinTone:UP.skinTone||'medium',chatHistory:_sbotH.slice(-6)})});
    document.getElementById(tid)?.closest('.sbot-msg')?.remove();
    if(!r.ok) throw new Error('err');
    const d=await r.json();
    _sbotAdd('ai', d.reply||"Here's what I recommend!");
    _sbotH.push({role:'assistant',content:d.reply||''});
    (d.products||[]).slice(0,2).forEach(p=>{
      const url=p.affiliateUrl||`https://www.nykaa.com/search/result/?q=${encodeURIComponent(p.name)}`;
      _sbotAddRaw(`<div class="sbot-msg ai"><div class="sbot-av">🛒</div>
        <div class="sbot-pcard" onclick="window.open('${url}','_blank')">
          <span style="font-size:2rem">${p.emoji||'✨'}</span>
          <div style="flex:1"><div class="sbot-pname">${_esc(p.name)}</div>
          <div class="sbot-preason">${_esc(p.description||'')}</div>
          <div style="display:flex;align-items:center;gap:8px"><span class="sbot-pprice">₹${p.price||'—'}</span>
          <button class="sbot-pbuy">Shop →</button></div></div>
        </div></div>`);
    });
    if(soundOn!==false) speakText((d.reply||'').slice(0,100));
  } catch{
    document.getElementById(tid)?.closest('.sbot-msg')?.remove();
    _sbotAdd('ai','Connection issue. Please check internet and try again!');
  }
};

function _sbotAdd(role, txt) {
  _sbotAddRaw(`<div class="sbot-msg ${role}">${role==='ai'?'<div class="sbot-av">🛒</div>':''}<div class="sbot-bubble">${_esc(txt)}</div></div>`);
}
function _sbotAddRaw(html) {
  const sc=document.getElementById('sbotScroll');
  if(!sc) return;
  sc.insertAdjacentHTML('beforeend',html);
  sc.scrollTop=sc.scrollHeight;
}
function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

console.log('✅ Vibe Mirror AI v6 — all features loaded, camera untouched');

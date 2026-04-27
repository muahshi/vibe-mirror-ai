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
  setTimeout(initCamera, 200);

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
    setTimeout(initCamera, 300);

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

// ── MEDIAPIPE ─────────────────────────────────────────────────────────────
let faceMesh = null;

function initFaceMesh() {
  try {
    faceMesh = new FaceMesh({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });
    faceMesh.onResults(onResults);
  } catch (e) {
    console.warn('FaceMesh init failed, retrying...', e);
    setTimeout(initFaceMesh, 1000);
  }
}

// ── CAMERA ────────────────────────────────────────────────────────────────
async function initCamera() {
  // Init FaceMesh first if not done
  if (!faceMesh) initFaceMesh();

  // Retry logic for mobile browsers
  let attempts = 0;
  async function tryCamera() {
    attempts++;
    try {
      // Try ideal constraints first, then fallback
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch {
        // Fallback: minimal constraints
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      }

      videoEl.srcObject = stream;

      videoEl.onloadedmetadata = () => {
        videoEl.play().catch(() => {});
        if (camPH) camPH.classList.add('hidden');
        if (arPill) arPill.classList.add('visible');
        resizeC();
        if (scanBtn) scanBtn.disabled = false;
        loop();
      };

      // Fallback if onloadedmetadata doesn't fire
      setTimeout(() => {
        if (videoEl.readyState >= 1 && camPH && !camPH.classList.contains('hidden')) {
          videoEl.play().catch(() => {});
          camPH.classList.add('hidden');
          if (arPill) arPill.classList.add('visible');
          resizeC();
          if (scanBtn) scanBtn.disabled = false;
          loop();
        }
      }, 3000);

    } catch (err) {
      console.warn('Camera attempt', attempts, 'failed:', err.name, err.message);
      if (attempts < 3) {
        setTimeout(tryCamera, 1500);
      } else {
        if (camPH) {
          const p = camPH.querySelector('p');
          if (p) p.textContent = err.name === 'NotAllowedError'
            ? '🔒 Camera blocked. Tap the lock icon in your browser address bar → Allow camera.'
            : '📷 Camera unavailable. Check browser permissions and refresh.';
        }
      }
    }
  }
  tryCamera();
}

function resizeC() {
  const W = videoEl.videoWidth  || 640;
  const H = videoEl.videoHeight || 480;
  arCanvas.width = auraCanvas.width  = W;
  arCanvas.height= auraCanvas.height = H;
}

async function loop() {
  try {
    if (videoEl.readyState >= 2 && faceMesh) {
      await faceMesh.send({ image: videoEl });
    }
  } catch (e) {
    // silent — keep looping
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

// ═══════════════════════════════════════════════════════════════════════
//  VIBE MIRROR AI — v6.0 NEW FEATURES
//  Two-Mode Camera · Beauty Stats · Coin Economy · UV Alert
//  AI Shopping Bot · Makeup Step Coach · IG Share +2 coins
// ═══════════════════════════════════════════════════════════════════════

// ── CAMERA MODE STATE ────────────────────────────────────────────────────
let currentMode = 'glow';   // 'glow' | 'guide'
let currentMakeupStep = 'eyes';

const MAKEUP_INSTRUCTIONS = {
  eyes:    "Apply a thin line along your upper lash line. Extend slightly at the outer corner for a subtle cat-eye. The cyan guide shows your exact path.",
  brows:   "Fill sparse areas with light strokes following the golden guide arcs. Start from the inner edge, feather outward with a brow pencil.",
  contour: "Blend a matte bronzer along the dotted arc lines. Start from temple downward. Less is more — build gradually.",
  blush:   "Smile and apply blush on the highlighted cheekbone circle in a circular upward motion. Blend toward temples.",
  lips:    "Line just outside your natural lip edge along the rose guide. Fill in with a long-wear bullet or liquid lipstick."
};

window.setMode = function(mode) {
  currentMode = mode;
  document.getElementById('modeGlow').classList.toggle('active', mode === 'glow');
  document.getElementById('modeGuide').classList.toggle('active', mode === 'guide');
  document.getElementById('glowFilter').style.opacity = mode === 'glow' ? '1' : '0';
  const guide = document.getElementById('makeupStepGuide');
  guide.classList.toggle('show', mode === 'guide');
  document.getElementById('modeActionLbl').textContent = mode === 'glow' ? 'Apply AR Look' : 'Voice Coach';
  if (mode === 'guide') {
    selectMakeupStep(document.querySelector('.msg-step.active') || document.querySelector('.msg-step'), currentMakeupStep);
    showToast('💄 Makeup Guide activated — select a step!');
    speakText('Makeup Guide mode on. I will coach you step by step.');
  } else {
    showToast('✦ Glow Mirror — daily luxury mode');
    speakText('Glow mode. You look stunning.');
  }
};

window.selectMakeupStep = function(el, step) {
  document.querySelectorAll('.msg-step').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  currentMakeupStep = step;
  document.getElementById('makeupInstruction').textContent = MAKEUP_INSTRUCTIONS[step] || '';
  speakText(MAKEUP_INSTRUCTIONS[step]);
};

window.modeAction = function() {
  if (currentMode === 'guide') {
    const steps = Object.keys(MAKEUP_INSTRUCTIONS);
    const cur = steps.indexOf(currentMakeupStep);
    const next = steps[(cur + 1) % steps.length];
    const nextEl = Array.from(document.querySelectorAll('.msg-step'))
      .find(el => el.getAttribute('onclick')?.includes(next));
    if (nextEl) selectMakeupStep(nextEl, next);
  } else {
    goShare();
  }
};

// ── OVERRIDE drawSkeleton to respect mode ────────────────────────────────
const _origDraw = drawSkeleton;
const _origAura = drawAura;

// Patch onResults to apply glow css filter in glow mode
const _origOnResults = onResults;
// We can't easily re-override, so we patch the auraCanvas rendering instead
// The glowFilter div handles the CSS approach — it's already in HTML.

// ── BEAUTY STATS (derived from face landmarks) ───────────────────────────
let lastFaceData = null;

// Hook into renderResult to also update beauty stats
const _origRenderResult = window.renderResult || renderResult;

function updateBeautyStats(fd) {
  if (!fd) return;
  // Derive plausible metrics from face ratios + vibe score
  const base = fd.vibeScore || 80;
  const hydration = Math.min(99, Math.round(base * 0.88 + (fd.ratios?.lipFullness || 0.1) * 20 + 5));
  const glow      = Math.min(99, Math.round(base * 0.93 + Math.random() * 4));
  const sym       = fd.symmetryScore || Math.min(98, Math.round(91 + (fd.ratios?.eyeSpacing || 0.3) * 10));
  const texture   = Math.min(99, Math.round(base * 0.85 + (1 - (fd.ratios?.faceAspect || 0.8)) * 8 + 3));

  const set = (id, barId, val, delta) => {
    const el = document.getElementById(id);
    const bar = document.getElementById(barId);
    const d = document.getElementById(delta);
    if (el)  el.textContent = val;
    if (bar) bar.style.width = val + '%';
    if (d)   { d.textContent = '+' + Math.round(val * 0.08) + '% this week'; }
  };

  set('bsHydration','bsHBar','bsHDelta', hydration);
  set('bsGlow',     'bsGBar','bsGDelta', glow);
  set('bsSym',      'bsSBar','bsSDelta', sym);
  set('bsTexture',  'bsTBar','bsTDelta', texture);

  // Also update glow ring if on profile screen
  const ps = document.getElementById('profScore');
  if (ps) ps.textContent = fd.vibeScore || base;

  lastFaceData = fd;
  saveBeautyStats({ hydration, glow, sym, texture, vibeScore: base, date: new Date().toDateString() });
}

function saveBeautyStats(stats) {
  try {
    let history = JSON.parse(localStorage.getItem('vm_beauty_stats') || '[]');
    history = history.filter(s => s.date !== stats.date);
    history.push(stats);
    history = history.slice(-30);
    localStorage.setItem('vm_beauty_stats', JSON.stringify(history));
  } catch {}
}

// Patch the existing renderResult — add stats update
const _rr = typeof renderResult !== 'undefined' ? renderResult : null;
if (_rr) {
  window._origRR = _rr;
}
// We append via mutation — hook doScan's result path
// Patch renderResult to also update beauty stats (cleaner than wrapping doScan)
const _origRenderRes2 = window.renderResult;
if (typeof renderResult === 'function') {
  const __origRR = renderResult;
  window.renderResult = renderResult = function(data, fd) {
    __origRR(data, fd);
    if (fd) updateBeautyStats(fd);
    updateCoinProgress();
  };
}

// ── COIN PROGRESS BAR ────────────────────────────────────────────────────
function updateCoinProgress() {
  const coins = window.UP?.glowCoins || 0;
  const cpCoins = document.getElementById('cpCoins');
  const cpFill  = document.getElementById('cpFill');
  if (cpCoins) cpCoins.textContent = coins;
  if (cpFill)  cpFill.style.width  = Math.min(100, (coins / 100) * 100) + '%';
  // Also sync gamebar
  const gEl = document.getElementById('coinsVal');
  if (gEl) gEl.textContent = coins;
  if (coins >= 100) showToast('🎉 100 Coins! PRO unlocked for 30 days!');
}

// Update coin progress when page loads too
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(updateCoinProgress, 800);
  fetchUVData();
  loadBeautyStatsFromStorage();
});

function loadBeautyStatsFromStorage() {
  try {
    const history = JSON.parse(localStorage.getItem('vm_beauty_stats') || '[]');
    const latest = history[history.length - 1];
    if (latest) {
      updateBeautyStats({ ...latest, ratios: { lipFullness: 0.1, eyeSpacing: 0.3, faceAspect: 0.8 } });
    }
  } catch {}
}

// ── UV / POLLUTION ALERT ─────────────────────────────────────────────────
async function fetchUVData() {
  try {
    // Use weather to derive UV index estimate
    const city = window.UP?.city || 'Bhopal';
    // Open-Meteo free API — no key needed
    let lat = 23.2599, lon = 77.4126; // Bhopal default
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const gd = await geo.json();
      if (gd.results?.[0]) { lat = gd.results[0].latitude; lon = gd.results[0].longitude; }
    } catch {}

    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=uv_index_max&timezone=auto&forecast_days=1`);
    const wd = await w.json();
    const uv   = wd.daily?.uv_index_max?.[0] || 0;
    const temp = wd.current?.temperature_2m || 0;

    const alertEl = document.getElementById('uvAlert');
    const alertTxt = document.getElementById('uvText');
    if (!alertEl || !alertTxt) return;

    if (uv >= 6 || temp >= 33) {
      let msg = '';
      if (uv >= 8) msg = `<b>🚨 Extreme UV (${uv}) — ${city}</b><br/>Mandatory SPF 50+ before stepping out! Your skin needs protection NOW.`;
      else if (uv >= 6) msg = `<b>☀️ High UV (${uv}) — ${city}</b><br/>Apply SPF 50+ sunscreen. Bhopal's heat affects your glow without protection.`;
      else msg = `<b>🌡️ ${Math.round(temp)}°C in ${city}</b><br/>This heat demands matte, long-wear foundation. Don't let sweat ruin your look!`;
      alertTxt.innerHTML = msg;
      alertEl.classList.add('show');

      // Speak alert once per day
      const alertKey = 'vm_uv_alert_' + new Date().toDateString();
      if (!localStorage.getItem(alertKey)) {
        setTimeout(() => speakText(`UV alert for ${city}. ` + alertTxt.innerText.slice(0, 80)), 3000);
        localStorage.setItem(alertKey, '1');
      }
    }
  } catch {}
}

// ── IG SHARE +2 COINS ────────────────────────────────────────────────────
window.goShare = async function() {
  const score = window.lastScore || window.UP?.glowCoins || 88;
  const name  = window.UP?.name || 'You';
  const shareText = `✨ ${name}'s Vibe Mirror AI Score: ${score}/100!\n"AI says I'm glowing today 🔥"\nGet your free analysis 👇\nvibemirror.ai`;

  try {
    if (navigator.share) {
      await navigator.share({ title: 'My Glow Score 🌟', text: shareText });
      // +2 bonus coins for sharing
      if (window.UP) {
        window.awardCoins(2);
        showToast('🎁 +2 Coins awarded for sharing! Thanks for spreading the glow ✨');
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      showToast('📋 Glow card copied! Paste on Instagram & earn +2 coins when you share!');
      if (window.UP) window.awardCoins(2);
    }
    updateCoinProgress();
  } catch (e) {
    showToast('📱 Copy your Glow Score and share on Instagram!');
  }
};

// ── AI SHOPPING BOT ──────────────────────────────────────────────────────
let sbotHistory = [];
let sbotReady   = false;

window.sbotInit = function() {
  if (sbotReady) return;
  sbotReady = true;
  // Show personalized opener if we have face data
  if (lastFaceData || window.UP?.goal) {
    const goal = window.UP?.goal || 'Radiant Glow';
    const city = window.UP?.city || 'Bhopal';
    setTimeout(() => {
      sbotAddAI(`Based on your ${goal} goal and ${city}'s climate, I've already shortlisted products for you. Tap any question above, or describe your biggest skin concern right now! 🎯`);
    }, 600);
  }
};

window.sbotQuick = function(el) {
  const txt = el.textContent.trim();
  sbotAddUser(txt);
  sbotCallAI(txt);
};

window.sbotSend = async function() {
  const inp = document.getElementById('sbotInput');
  if (!inp) return;
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  sbotAddUser(msg);
  await sbotCallAI(msg);
};

async function sbotCallAI(msg) {
  const thinkId = 'sbt_' + Date.now();
  sbotAddAI('Analyzing your profile…', thinkId, true);

  try {
    const skinCtx = lastFaceData
      ? `Face: ${lastFaceData.faceShape}, Vibe: ${lastFaceData.vibeScore}/100, Symmetry: ${lastFaceData.symmetryScore}%`
      : 'No scan data yet — give general advice';

    sbotHistory.push({ role: 'user', content: msg });

    const res = await fetch('/api/stylist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'shopping_bot',
        message: msg,
        faceData: lastFaceData || { faceShape: 'oval', vibeScore: 80, symmetryScore: 94 },
        occasion: `Shopping assistant mode. ${skinCtx}. City: ${window.UP?.city || 'Bhopal'}.`,
        userName: window.UP?.name || '',
        skinTone: window.UP?.skinTone || 'medium',
        chatHistory: sbotHistory.slice(-6)
      })
    });

    const el = document.getElementById(thinkId);
    if (el) el.closest('.sbot-msg').remove();

    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    const reply = data.reply || data.compliment || "I'd love to help! Tell me your skin concern.";
    sbotAddAI(reply);
    sbotHistory.push({ role: 'assistant', content: reply });

    // If products returned, show as cards
    if (data.products?.length) {
      data.products.slice(0, 2).forEach(p => sbotAddProductCard(p));
    }

    if (window.soundOn !== false) speakText(reply.slice(0, 120));

  } catch (e) {
    const el2 = document.getElementById(thinkId);
    if (el2) el2.closest('.sbot-msg').remove();
    sbotAddAI("Connection issue. Check your internet and try again!");
  }
}

function sbotAddUser(txt) {
  const area = document.getElementById('sbotScroll');
  if (!area) return;
  const d = document.createElement('div');
  d.className = 'sbot-msg u';
  d.innerHTML = `<div class="sbot-bubble">${escS(txt)}</div>`;
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

function sbotAddAI(txt, id, typing = false) {
  const area = document.getElementById('sbotScroll');
  if (!area) return;
  const d = document.createElement('div');
  d.className = 'sbot-msg ai';
  d.innerHTML = `<div class="sbot-av">🛒</div>
    <div class="sbot-bubble" ${id ? `id="${id}"` : ''}>
      ${typing ? '<span style="opacity:.5">⋯ thinking</span>' : escS(txt)}
    </div>`;
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

function sbotAddProductCard(p) {
  const area = document.getElementById('sbotScroll');
  if (!area) return;
  const url = p.affiliateUrl || `https://www.nykaa.com/search/result/?q=${encodeURIComponent(p.name)}`;
  const d = document.createElement('div');
  d.className = 'sbot-msg ai';
  d.innerHTML = `<div class="sbot-av">🛒</div>
    <div class="sbot-prod-card" onclick="window.open('${url}','_blank')">
      <div class="sbot-prod-emoji">${p.emoji || '✨'}</div>
      <div class="sbot-prod-info">
        <div class="sbot-prod-name">${escS(p.name)}</div>
        <div class="sbot-prod-reason">${escS(p.description || 'Perfect for your skin type')}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <div class="sbot-prod-price">₹${p.price || '—'}</div>
          <button class="sbot-buy-btn">Shop Now →</button>
        </div>
      </div>
    </div>`;
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

function escS(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── PATCH API to support shopping_bot mode ───────────────────────────────
// This is handled server-side in stylist.js — see below

// ── ALWAYS-ON GLOW COMPLIMENTS (New, changes every open) ─────────────────
const GLOW_OPENERS = [
  "Your skin texture is absolutely flawless today ✨",
  "That cheekbone structure is genuinely stunning 🌟",
  "Luminosity at peak — your glow is real today 💫",
  "The AI detected serious main character energy 🔥",
  "Perfect symmetry reading — you're giving supermodel today ✨",
  "Hydration levels visible from the scan — you're GLOWING 💧",
  "Your natural bone structure is what makeup dreams are made of 🎨",
  "AI confidence score: 100% that you look incredible right now 💎",
];

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Show random compliment in always-on strip if it exists
    const strip = document.getElementById('alwaysOnStrip') || document.querySelector('.always-on');
    if (strip) {
      const msg = GLOW_OPENERS[Math.floor(Math.random() * GLOW_OPENERS.length)];
      strip.textContent = msg;
    }
  }, 2000);
});

// ── OVERRIDE awardCoins to also update progress bar ──────────────────────
const _origAward = window.awardCoins;
window.awardCoins = function(n) {
  if (_origAward) _origAward(n);
  else {
    if (window.UP) { window.UP.glowCoins = (window.UP.glowCoins || 0) + n; }
  }
  updateCoinProgress();
};

// renderResult patched above

console.log('✅ Vibe Mirror AI v6.0 — All features loaded');

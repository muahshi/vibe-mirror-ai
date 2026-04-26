/**
 * Vibe Mirror AI — script.js v3.0
 * Premium Beauty Ecosystem
 * Privacy: Face data NEVER leaves the browser. Only numerical ratios sent to API.
 *
 * NEW FEATURES:
 * - Onboarding with localStorage persistence
 * - Digital Skeleton AR (Gold/White geometry lines)
 * - Dynamic Golden Aura (follows head movement)
 * - Coach Mode (dotted AR overlays for eyes/lips)
 * - Symmetry Score + encouragingly high display
 * - Hype-Man engine with Web Speech API (Female/Male voice)
 * - Gamification: Streak, Glow Coins (20 per scan)
 * - Front Flash effect during scan
 * - Hyper-local Bhopal context
 * - Glow Share card generation
 */

// ── DOM REFS ──────────────────────────────────────────────────────────────
const videoEl        = document.getElementById('videoEl');
const arCanvas       = document.getElementById('arCanvas');
const auraCanvas     = document.getElementById('auraCanvas');
const ctx            = arCanvas.getContext('2d');
const auraCtx        = auraCanvas.getContext('2d');
const hypeBtn        = document.getElementById('hypeBtn');
const occasionInput  = document.getElementById('occasionInput');
const camPlaceholder = document.getElementById('camPlaceholder');
const arGuidePill    = document.getElementById('arGuidePill');
const vibeNum        = document.getElementById('vibeNum');
const vibeBar        = document.getElementById('vibeBar');
const complimentEl   = document.getElementById('complimentEl');
const productsScroll = document.getElementById('productsScroll');
const flashOverlay   = document.getElementById('flashOverlay');
const greetingPill   = document.getElementById('greetingPill');
const streakVal      = document.getElementById('streakVal');
const coinsVal       = document.getElementById('coinsVal');
const symmetryChip   = document.getElementById('symmetryChip');
const statScans      = document.getElementById('statScans');
const statCoinsDisplay = document.getElementById('statCoinsDisplay');
const statStreakDisplay = document.getElementById('statStreak');

// ── USER PROFILE (localStorage) ───────────────────────────────────────────
const STORAGE_KEY = 'vm_profile_v3';

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveProfile(profile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
}

let userProfile = loadProfile() || {
  name: '',
  goal: 'Glow & Radiance',
  voice: 'female',
  scanCount: 0,
  glowCoins: 0,
  streak: 1,
  lastScanDate: null,
  onboardingDone: false,
};

// ── ONBOARDING ────────────────────────────────────────────────────────────
let onboardStep = 0;
let selectedGoal = userProfile.goal;
let selectedVoice = userProfile.voice;

window.nextOnboardStep = function() {
  if (onboardStep === 0) {
    const name = document.getElementById('nameInput').value.trim();
    if (name) userProfile.name = name;
  }
  document.getElementById('step' + onboardStep).classList.remove('active');
  document.getElementById('dot' + onboardStep).classList.remove('active');
  onboardStep++;
  document.getElementById('step' + onboardStep).classList.add('active');
  document.getElementById('dot' + onboardStep).classList.add('active');
};

window.selectGoal = function(el, goal) {
  document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedGoal = goal;
  userProfile.goal = goal;
};

window.selectVoice = function(type) {
  document.getElementById('voiceFemale').classList.toggle('selected', type === 'female');
  document.getElementById('voiceMale').classList.toggle('selected', type === 'male');
  selectedVoice = type;
  userProfile.voice = type;
  // Preview voice
  speakText(type === 'female' ? 'Hi! I\'m Aura, your beauty guide.' : 'Hello! I\'m Marcus, your style expert.');
};

window.finishOnboarding = function() {
  userProfile.onboardingDone = true;
  saveProfile(userProfile);
  launchApp();
};

window.skipOnboarding = function() {
  userProfile.onboardingDone = true;
  saveProfile(userProfile);
  launchApp();
};

window.resetOnboarding = function() {
  userProfile.onboardingDone = false;
  saveProfile(userProfile);
  location.reload();
};

function launchApp() {
  document.getElementById('onboardScreen').classList.remove('active');
  document.getElementById('mirrorScreen').classList.add('active');
  // Show bottom nav
  document.getElementById('bottomNav').style.display = 'flex';
  initCamera();
  updateGamebar();
  updateProfileUI();

  // Greet user
  if (userProfile.name) {
    greetingPill.textContent = `✨ Hi, ${userProfile.name}! Ready to glow?`;
    greetingPill.style.display = 'block';
    setTimeout(() => { greetingPill.style.display = 'none'; }, 4000);
  }
}

// Check if onboarding done on load
window.addEventListener('DOMContentLoaded', () => {
  if (userProfile.onboardingDone) {
    document.getElementById('onboardScreen').classList.remove('active');
    document.getElementById('mirrorScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';
    initCamera();
    updateGamebar();
    updateProfileUI();

    if (userProfile.name) {
      greetingPill.textContent = `✨ Welcome back, ${userProfile.name}!`;
      greetingPill.style.display = 'block';
      setTimeout(() => { greetingPill.style.display = 'none'; }, 3500);
    }
  } else {
    document.getElementById('bottomNav').style.display = 'none';
  }
});

// ── GAMIFICATION ─────────────────────────────────────────────────────────
function updateGamebar() {
  streakVal.textContent = userProfile.streak || 1;
  coinsVal.textContent  = userProfile.glowCoins || 0;
}

function updateProfileUI() {
  statScans.textContent        = userProfile.scanCount || 0;
  statCoinsDisplay.textContent = userProfile.glowCoins || 0;
  statStreakDisplay.textContent = userProfile.streak || 1;
  if (userProfile.name) {
    document.getElementById('profileName').textContent = userProfile.name + "'s Aura";
  }
}

function awardCoins(amount) {
  userProfile.glowCoins = (userProfile.glowCoins || 0) + amount;
  updateGamebar();
  updateProfileUI();
  saveProfile(userProfile);
  showToast(`⭐ +${amount} Glow Coins earned!`);
}

function updateStreak() {
  const today = new Date().toDateString();
  if (userProfile.lastScanDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (userProfile.lastScanDate === yesterday) {
      userProfile.streak = (userProfile.streak || 1) + 1;
    } else if (!userProfile.lastScanDate) {
      userProfile.streak = 1;
    }
    userProfile.lastScanDate = today;
    updateGamebar();
    updateProfileUI();
    saveProfile(userProfile);
  }
}

// ── MEDIAPIPE ────────────────────────────────────────────────────────────
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

// ── CAMERA ────────────────────────────────────────────────────────────────
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
      hypeBtn.disabled = false;
      runLoop();
    };
  } catch (e) {
    camPlaceholder.querySelector('p').textContent =
      'Camera access denied. Please allow camera and refresh.';
  }
}

function resizeCanvas() {
  arCanvas.width  = auraCanvas.width  = videoEl.videoWidth  || 640;
  arCanvas.height = auraCanvas.height = videoEl.videoHeight || 480;
}

let animFrame = null;
async function runLoop() {
  if (videoEl.readyState >= 2) {
    await faceMesh.send({ image: videoEl });
  }
  animFrame = requestAnimationFrame(runLoop);
}

// ── STATE ─────────────────────────────────────────────────────────────────
let latestLandmarks  = null;
let smoothScore      = 0;
let smoothSymmetry   = 95;
let auraAngle        = 0;
let auraX            = 0.5;
let auraY            = 0.5;
let speechEnabled    = true;
let lastCompliment   = '';

// ── MEDIAPIPE RESULTS ─────────────────────────────────────────────────────
function onResults(results) {
  ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
  auraCtx.clearRect(0, 0, auraCanvas.width, auraCanvas.height);

  if (results.multiFaceLandmarks?.length) {
    latestLandmarks = results.multiFaceLandmarks[0];
    hypeBtn.disabled = false;
    drawAura(latestLandmarks);
    drawDigitalSkeleton(latestLandmarks);
    updateVibeScore(latestLandmarks);
  } else {
    latestLandmarks = null;
    smoothScore = Math.max(0, smoothScore - 0.5);
    vibeNum.textContent = smoothScore > 5 ? Math.round(smoothScore) : '—';
    vibeBar.style.width = smoothScore + '%';
  }
}

// ── DYNAMIC GOLDEN AURA ──────────────────────────────────────────────────
function drawAura(lm) {
  const W = auraCanvas.width, H = auraCanvas.height;

  // Track nose tip for head movement
  const noseTip = lm[1];
  const targetX = noseTip.x * W;
  const targetY = noseTip.y * H;

  // Smooth follow
  auraX += (targetX - auraX) * 0.08;
  auraY += (targetY - auraY) * 0.08;
  auraAngle += 0.012;

  // Outer glow halo — follows head
  const faceW = Math.abs(lm[454].x - lm[234].x) * W;
  const radius = faceW * 0.75;

  const grad = auraCtx.createRadialGradient(auraX, auraY - radius * 0.3, 0, auraX, auraY - radius * 0.3, radius * 1.4);
  grad.addColorStop(0, 'rgba(200,150,90,0.18)');
  grad.addColorStop(0.4, 'rgba(200,150,90,0.08)');
  grad.addColorStop(1, 'rgba(200,150,90,0)');

  auraCtx.fillStyle = grad;
  auraCtx.beginPath();
  auraCtx.ellipse(auraX, auraY - radius * 0.3, radius * 1.4, radius * 1.8, 0, 0, Math.PI * 2);
  auraCtx.fill();

  // Rotating inner spark
  for (let i = 0; i < 3; i++) {
    const angle = auraAngle + (i * Math.PI * 2) / 3;
    const sx = auraX + Math.cos(angle) * radius * 0.55;
    const sy = (auraY - radius * 0.3) + Math.sin(angle) * radius * 0.42;
    const sparkGrad = auraCtx.createRadialGradient(sx, sy, 0, sx, sy, 18);
    sparkGrad.addColorStop(0, 'rgba(240,210,150,0.55)');
    sparkGrad.addColorStop(1, 'rgba(240,210,150,0)');
    auraCtx.fillStyle = sparkGrad;
    auraCtx.beginPath();
    auraCtx.arc(sx, sy, 18, 0, Math.PI * 2);
    auraCtx.fill();
  }
}

// ── DIGITAL SKELETON (AR) ────────────────────────────────────────────────
// Landmark index groups
const OVAL_IDX  = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const L_EYE     = [33,160,158,133,153,144];
const R_EYE     = [362,385,387,263,373,380];
const LIPS_OUTER= [61,84,17,314,291,409,270,269,267,0,37,39,40,185];
const LIPS_INNER= [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191,78];
const L_BROW    = [70,63,105,66,107,55,65,52,53,46];
const R_BROW    = [300,293,334,296,336,285,295,282,283,276];
const NOSE_BRIDGE=[168,6,197,195,5,4,1,19,94,2];
const NOSE_TIP  = 1;
const CHEEK_L   = 234;
const CHEEK_R   = 454;

// Golden ratio lines: forehead, nose, chin dividers
const GOLDEN_TOP    = 10;
const GOLDEN_BROW   = 107;
const GOLDEN_NOSE   = 4;
const GOLDEN_LIP    = 17;
const GOLDEN_CHIN   = 152;

function lmPx(lm, idx, W, H) {
  return [lm[idx].x * W, lm[idx].y * H];
}

function drawDigitalSkeleton(lm) {
  const W = arCanvas.width, H = arCanvas.height;

  // ── Face oval — gold dashed
  ctx.strokeStyle = 'rgba(220,180,100,0.5)';
  ctx.lineWidth   = 1.6;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  OVAL_IDX.forEach((idx, i) => {
    const [x, y] = lmPx(lm, idx, W, H);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Brows — bright gold solid
  ctx.strokeStyle = 'rgba(240,200,120,0.75)';
  ctx.lineWidth = 1.8;
  drawOpenLine(lm, L_BROW, W, H, 'rgba(240,200,120,0.75)', 1.8);
  drawOpenLine(lm, R_BROW, W, H, 'rgba(240,200,120,0.75)', 1.8);

  // ── Eye circles — white-blue glow
  drawClosedLine(lm, L_EYE, W, H, 'rgba(200,230,255,0.72)', 1.5);
  drawClosedLine(lm, R_EYE, W, H, 'rgba(200,230,255,0.72)', 1.5);

  // ── Eyeliner coach overlay (dotted path)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([2, 4]);
  drawOpenLine(lm, L_EYE, W, H, 'rgba(255,255,255,0.45)', 1.2);
  drawOpenLine(lm, R_EYE, W, H, 'rgba(255,255,255,0.45)', 1.2);
  ctx.setLineDash([]);

  // ── Nose bridge — subtle white
  drawOpenLine(lm, NOSE_BRIDGE, W, H, 'rgba(255,255,255,0.22)', 1.0);

  // ── Lips outer — rose pink solid
  drawClosedLine(lm, LIPS_OUTER, W, H, 'rgba(220,120,110,0.72)', 1.6);

  // ── Lips inner — dotted coach overlay
  ctx.setLineDash([2, 4]);
  drawClosedLine(lm, LIPS_INNER, W, H, 'rgba(255,160,140,0.45)', 1.2);
  ctx.setLineDash([]);

  // ── Golden Ratio lines (horizontal)
  const [tlx, tly] = lmPx(lm, GOLDEN_TOP, W, H);
  const [blx, bly] = lmPx(lm, GOLDEN_BROW, W, H);
  const [nlx, nly] = lmPx(lm, GOLDEN_NOSE, W, H);
  const [lpx, lpy] = lmPx(lm, GOLDEN_LIP, W, H);
  const [clx, cly] = lmPx(lm, GOLDEN_CHIN, W, H);

  const faceL = lm[234].x * W - 20;
  const faceR = lm[454].x * W + 20;

  const goldenColor = 'rgba(220,180,100,0.28)';
  [[tly], [bly], [nly], [lpy], [cly]].forEach(([y]) => {
    ctx.strokeStyle = goldenColor;
    ctx.lineWidth   = 0.8;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(faceL, y);
    ctx.lineTo(faceR, y);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // ── Cheekbone highlight dots + glow rings
  const GLOW_POINTS = [CHEEK_L, CHEEK_R, NOSE_TIP, 61, 291];
  GLOW_POINTS.forEach(idx => {
    const [x, y] = lmPx(lm, idx, W, H);
    const isLip = (idx === 61 || idx === 291);
    const color  = isLip ? [210, 120, 100] : [220, 180, 100];
    const [r, g, b] = color;

    // Outer glow ring
    const grad = ctx.createRadialGradient(x, y, 0, x, y, isLip ? 10 : 16);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, isLip ? 10 : 16, 0, Math.PI * 2);
    ctx.fill();

    // Center bright dot
    ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Grid intersection micro-dots on skeleton keypoints
  const GRID_DOTS = [9, 10, 152, 234, 454, 33, 263, 1, 61, 291, 107, 336];
  GRID_DOTS.forEach(idx => {
    const [x, y] = lmPx(lm, idx, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawClosedLine(lm, indices, W, H, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.beginPath();
  indices.forEach((idx, i) => {
    const [x, y] = lmPx(lm, idx, W, H);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
}

function drawOpenLine(lm, indices, W, H, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.beginPath();
  indices.forEach((idx, i) => {
    const [x, y] = lmPx(lm, idx, W, H);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ── VIBE SCORE (live smooth) ──────────────────────────────────────────────
function updateVibeScore(lm) {
  const faceL   = lm[234], faceR = lm[454];
  const center  = (faceL.x + faceR.x) / 2;
  const symRaw  = Math.max(0, 1 - Math.abs(lm[NOSE_TIP].x - center) * 5);
  const target  = 68 + symRaw * 28;

  smoothScore += (target - smoothScore) * 0.04;
  const display = Math.round(smoothScore);

  vibeNum.textContent = display;
  vibeBar.style.width  = display + '%';

  // Symmetry: encourage high (90-99%)
  const rawSym = Math.round(symRaw * 12 + 88);
  smoothSymmetry += (rawSym - smoothSymmetry) * 0.05;
  symmetryChip.textContent = '◈ ' + Math.min(99, Math.round(smoothSymmetry)) + '%';
}

// ── EXTRACT ANONYMOUS DATA ────────────────────────────────────────────────
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
  if (ratio < 0.78)            faceShape = 'oblong';
  else if (ratio > 0.95)       faceShape = 'round';
  else if ((jawW / faceW) < 0.7) faceShape = 'heart';

  const symRaw  = Math.max(0, 1 - Math.abs(lm[1].x - (lm[234].x + lm[454].x) / 2) * 5);
  const vScore  = Math.round(Math.min(96, 68 + symRaw * 28));
  const symPct  = Math.min(99, Math.round(symRaw * 12 + 88));

  return {
    faceShape,
    vibeScore: vScore,
    symmetryScore: symPct,
    userName: userProfile.name || 'Beautiful',
    goal: userProfile.goal,
    ratios: {
      faceAspect:  +(faceW / faceH).toFixed(3),
      eyeSpacing:  +(eyeD / faceW).toFixed(3),
      lipFullness: +(lipH / faceH).toFixed(3),
      jawToFace:   +(jawW / faceW).toFixed(3),
      noseToFace:  +(noseW / faceW).toFixed(3),
    }
  };
}

// ── FRONT FLASH ───────────────────────────────────────────────────────────
window.triggerFlash = function() {
  flashOverlay.style.opacity = '1';
  flashOverlay.style.transition = 'opacity 0.08s ease';
  setTimeout(() => {
    flashOverlay.style.opacity = '0';
    flashOverlay.style.transition = 'opacity 0.5s ease';
  }, 150);
};

// ── TRIGGER SCAN ─────────────────────────────────────────────────────────
window.triggerScan = async function() {
  if (!latestLandmarks) {
    showToast('🔍 Position your face in the frame first!');
    return;
  }

  // Flash effect for studio feeling
  triggerFlash();

  const occasion = occasionInput.value.trim() || `${userProfile.goal || 'casual look'} in Bhopal`;
  const faceData = extractAnonymousData(latestLandmarks);

  // Update scan count
  userProfile.scanCount++;
  updateStreak();
  saveProfile(userProfile);
  statScans.textContent = userProfile.scanCount;

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
    renderResults(data, faceData);

    // Award coins after successful scan
    awardCoins(20);

  } catch (err) {
    showErrorState(err.message);
  } finally {
    setLoadingState(false);
  }
};

// ── RENDER RESULTS ────────────────────────────────────────────────────────
const PLATFORM_MAP = {
  'Nykaa':   { cls: 'dot-nykaa',   label: 'Nykaa',   base: 'https://www.nykaa.com/search/result/?q=' },
  'Amazon':  { cls: 'dot-amazon',  label: 'Amazon',  base: 'https://www.amazon.in/s?k=' },
  'Myntra':  { cls: 'dot-myntra',  label: 'Myntra',  base: 'https://www.myntra.com/' },
  'Purplle': { cls: 'dot-purplle', label: 'Purplle', base: 'https://www.purplle.com/search?q=' },
};

function renderResults(data, faceData) {
  const { compliment, products, vibeScore } = data;

  const vs = vibeScore || faceData.vibeScore;
  vibeNum.textContent = vs;
  vibeBar.style.width = vs + '%';
  smoothScore = vs;

  // Personalize with name
  const personalCompliment = userProfile.name
    ? compliment.replace(/^(Your|You)/, userProfile.name + ', your').replace(/^([A-Z])/, (m) => m)
    : compliment;

  lastCompliment = personalCompliment;

  complimentEl.innerHTML = `
    <div class="compliment-tag">✦ <span>Aura · ${faceData.faceShape} face · Symmetry ${faceData.symmetryScore}%</span></div>
    <div>${escHtml(personalCompliment)}</div>
  `;

  // Products
  if (products?.length) {
    productsScroll.style.display = 'flex';
    productsScroll.innerHTML = products.map(p => buildProductCard(p)).join('');
  }

  // Update share overlay text
  document.getElementById('shareScore').textContent = vs;
  document.getElementById('shareCompliment').textContent = '"' + personalCompliment + '"';

  // Voice hype
  if (speechEnabled) {
    const greeting = userProfile.name ? `${userProfile.name}, ` : '';
    speakText(greeting + personalCompliment);
  }

  showToast('✨ Your look is ready!');
}

function buildProductCard(p) {
  const platform = p.platform || 'Nykaa';
  const pm       = PLATFORM_MAP[platform] || PLATFORM_MAP['Nykaa'];
  const url      = p.affiliateUrl || (pm.base + encodeURIComponent(p.name));
  const emoji    = p.emoji || '✨';
  const parts    = p.name.split(' ');
  const brand    = parts.slice(0, 2).join(' ');
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

// ── VOICE ENGINE (Web Speech API) ─────────────────────────────────────────
let voices = [];

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
  };
  // Trigger initial load
  voices = window.speechSynthesis.getVoices();
}

function getBestVoice(gender) {
  if (!voices.length) voices = window.speechSynthesis.getVoices();

  // Prefer Indian English voices
  const indianEN = voices.filter(v =>
    v.lang.startsWith('en') && (v.name.includes('India') || v.name.includes('IN'))
  );

  if (gender === 'female') {
    const pref = indianEN.find(v => v.name.toLowerCase().includes('female') || v.name.includes('Aditi') || v.name.includes('Raveena'))
      || indianEN[0]
      || voices.find(v => v.name.toLowerCase().includes('female') || v.name.includes('Samantha') || v.name.includes('Karen'))
      || voices.find(v => v.lang.startsWith('en'));
    return pref || null;
  } else {
    const pref = indianEN.find(v => v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('female'))
      || indianEN[1]
      || voices.find(v => v.name.includes('Daniel') || v.name.includes('Tom') || v.name.includes('Aaron'))
      || voices.find(v => v.lang.startsWith('en'));
    return pref || null;
  }
}

function speakText(text) {
  if (!speechEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = 'en-IN';

  const gender = userProfile.voice || 'female';
  const voice  = getBestVoice(gender);
  if (voice) utt.voice = voice;

  if (gender === 'female') {
    utt.pitch = 1.1;
    utt.rate  = 0.92;
  } else {
    utt.pitch = 0.88;
    utt.rate  = 0.88;
  }

  utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

// ── SOUND TOGGLE ──────────────────────────────────────────────────────────
window.toggleSound = function() {
  speechEnabled = !speechEnabled;
  document.getElementById('soundBtn').textContent = speechEnabled ? '🔊' : '🔇';
  showToast(speechEnabled ? 'Voice hype ON 🔊' : 'Voice hype OFF 🔇');
  if (!speechEnabled) window.speechSynthesis.cancel();
};

// ── LOADING STATE ────────────────────────────────────────────────────────
function setLoadingState(loading) {
  hypeBtn.disabled  = loading;
  hypeBtn.innerHTML = loading
    ? `<span class="btn-spinner"></span> Analyzing…`
    : `<span>📸</span> Scan Skin`;
}

// ── UTILS ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.showToast = function(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
};

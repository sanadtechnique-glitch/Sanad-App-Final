let _ctx: AudioContext | null = null;
let _unlocked = false;

function ctx(): AudioContext {
  if (!_ctx)
    _ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return _ctx;
}

export function unlockAudio() {
  if (_unlocked) return;
  try {
    const c = ctx();
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    _unlocked = true;
  } catch {}
}

function bell(
  c: AudioContext,
  freq: number,
  startTime: number,
  gainPeak: number,
  duration: number,
) {
  const osc1 = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  const master = c.createGain();

  osc1.type = "sine";
  osc1.frequency.value = freq;

  osc2.type = "triangle";
  osc2.frequency.value = freq * 2.756;

  const g2 = c.createGain();
  g2.gain.value = 0.12;

  osc1.connect(gain);
  osc2.connect(g2);
  g2.connect(gain);
  gain.connect(master);
  master.connect(c.destination);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(gainPeak * 0.4, startTime + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  master.gain.setValueAtTime(0.85, startTime);

  osc1.start(startTime);
  osc1.stop(startTime + duration);
  osc2.start(startTime);
  osc2.stop(startTime + duration);
}

export function playSanadSound() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();

    const now = c.currentTime;

    bell(c, 523.25, now,        0.35, 0.55);
    bell(c, 783.99, now + 0.14, 0.30, 0.70);
    bell(c, 659.25, now + 0.26, 0.22, 0.90);
    bell(c, 1046.5, now + 0.36, 0.28, 1.10);
  } catch {}
}

// Short urgent ping for incoming driver orders
export function playAlertSound() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    bell(c, 880,  now,        0.50, 0.35);
    bell(c, 1320, now + 0.12, 0.40, 0.55);
    bell(c, 1760, now + 0.22, 0.35, 0.80);
  } catch {}
}

// Distinct tone for admin broadcast messages
export function playBroadcastSound() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    bell(c, 440, now,        0.30, 0.40);
    bell(c, 554, now + 0.10, 0.25, 0.50);
    bell(c, 659, now + 0.20, 0.30, 0.70);
  } catch {}
}

// ─── Role-specific notification sounds ──────────────────────────────────────

function horn(c: AudioContext, freq: number, t: number, dur: number, vol = 0.6) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.linearRampToValueAtTime(freq * 0.88, t + dur * 0.8);

  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 1.2;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.015);
  gain.gain.setValueAtTime(vol, t + dur - 0.04);
  gain.gain.linearRampToValueAtTime(0, t + dur);

  osc.start(t);
  osc.stop(t + dur);
}

// 🚕 Taxi — Classic double-horn "beep beep"
export function playTaxiHorn() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    horn(c, 340, now,        0.18, 0.55);
    horn(c, 340, now + 0.25, 0.18, 0.55);
  } catch {}
}

function deepPulse(c: AudioContext, t: number) {
  const osc = c.createOscillator();
  const mod = c.createOscillator();
  const modGain = c.createGain();
  const gain = c.createGain();
  const lp = c.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.value = 90;

  mod.type = "sine";
  mod.frequency.value = 12;
  modGain.gain.value = 30;

  mod.connect(modGain);
  modGain.connect(osc.frequency);

  lp.type = "lowpass";
  lp.frequency.value = 300;

  osc.connect(lp);
  lp.connect(gain);
  gain.connect(c.destination);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.7, t + 0.02);
  gain.gain.setValueAtTime(0.7, t + 0.13);
  gain.gain.linearRampToValueAtTime(0, t + 0.18);

  osc.start(t);
  osc.stop(t + 0.2);
  mod.start(t);
  mod.stop(t + 0.2);
}

// 🚚 Truck — Three deep engine pulses
export function playTruckAlert() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    deepPulse(c, now);
    deepPulse(c, now + 0.28);
    deepPulse(c, now + 0.56);
  } catch {}
}

function ringBell(c: AudioContext, freq: number, t: number, vol = 0.55) {
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  osc.connect(gain);
  gain.connect(c.destination);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

  osc.start(t);
  osc.stop(t + 0.6);
}

// 🛵 Delivery — Bright double-ring (bicycle bell style)
export function playDeliveryBell() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    ringBell(c, 1350, now);
    ringBell(c, 1620, now + 0.22);
  } catch {}
}

// 🏪 Service Provider — Smooth ascending 4-note chime
export function playProviderChime() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    bell(c, 523.25, now,        0.28, 0.50);
    bell(c, 659.25, now + 0.15, 0.24, 0.65);
    bell(c, 783.99, now + 0.28, 0.22, 0.80);
    bell(c, 1046.5, now + 0.40, 0.32, 1.10);
  } catch {}
}

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

    bell(c, 523.25, now,       0.30, 0.55);
    bell(c, 783.99, now + 0.14, 0.25, 0.70);
    bell(c, 659.25, now + 0.26, 0.18, 0.90);
    bell(c, 1046.5, now + 0.36, 0.22, 1.10);
  } catch {}
}

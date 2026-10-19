/**
 * soundEffects.js
 * Browser-native Web Audio API synthesizer for gamified QuizMasterAI sounds.
 * 100% offline, zero external audio asset dependencies.
 */

let audioCtx = null;
let isMuted = false;

// Check localStorage for mute preference
try {
  const saved = localStorage.getItem('quizmaster_sfx_muted');
  if (saved !== null) {
    isMuted = JSON.parse(saved);
  }
} catch (e) {}

const getAudioContext = () => {
  if (isMuted) return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const toggleMuteSfx = () => {
  isMuted = !isMuted;
  try {
    localStorage.setItem('quizmaster_sfx_muted', JSON.stringify(isMuted));
  } catch (e) {}
  return isMuted;
};

export const getMuteStatus = () => isMuted;

export const playCountdownSound = (num) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const freq = num === 1 ? 880 : 440; // High tone on '1'
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.type = 'sine';

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.18);
};

export const playCorrectSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Major triad C5 - E5 - G5 ascending arpeggio
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startTime = ctx.currentTime + idx * 0.08;
    osc.frequency.setValueAtTime(freq, startTime);
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.25);
  });
};

export const playWrongSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Low descending buzz
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

export const playEmotePopSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // High upward bubble pop
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(450, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.15);
};

export const playVictorySound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Triumphant fanfare C5 - G5 - C6
  const notes = [
    { f: 523.25, d: 0.12 },
    { f: 659.25, d: 0.12 },
    { f: 783.99, d: 0.15 },
    { f: 1046.50, d: 0.45 }
  ];

  let time = ctx.currentTime;
  notes.forEach((item) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(item.f, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + item.d);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + item.d);
    time += item.d * 0.85;
  });
};

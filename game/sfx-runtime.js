(() => {
  "use strict";

  if (window.EimeiSfx?.active) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const storageKey = "eimei-sfx-settings-v1";
  const previewDocument = new URLSearchParams(location.search).get("eimei-preview") === "1";
  const cooldowns = new Map([
    ["ui", 45],
    ["jump", 70],
    ["double-jump", 90],
    ["grapple-attach", 90],
    ["grapple-release", 80],
    ["grapple-fail", 180],
    ["ladder-start", 180],
    ["ladder-end", 180],
    ["hatch-up", 220],
    ["hatch-down", 220],
    ["hatch-exit", 180],
    ["portal", 300],
    ["flag", 450],
    ["tutorial-complete", 320],
    ["hint", 500],
    ["private-hint", 350],
    ["wisp", 300],
    ["debuff-pickup", 300],
    ["debuff-cast", 300],
    ["debuff-hit", 400],
    ["round-start", 700],
    ["win", 900],
    ["lose", 900],
    ["result", 900],
    ["respawn", 450]
  ]);

  function readSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      const storedVolume = Number(stored?.volume);
      return {
        muted: Boolean(stored?.muted),
        volume: Number.isFinite(storedVolume) ? Math.max(0, Math.min(1, storedVolume)) : 0.42
      };
    } catch {
      return { muted: false, volume: 0.42 };
    }
  }

  const settings = readSettings();
  const state = {
    active: true,
    supported: Boolean(AudioContextClass),
    unlocked: false,
    muted: settings.muted,
    volume: settings.volume,
    lastPlayed: "",
    playedCount: 0,
    history: []
  };
  let context = null;
  let master = null;
  let compressor = null;
  let noiseBuffer = null;
  let controls = null;
  const lastPlayedAt = new Map();

  function saveSettings() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ muted: state.muted, volume: state.volume }));
    } catch {
      // Sound still works when storage is unavailable.
    }
  }

  function ensureContext() {
    if (!state.supported) return null;
    if (context) return context;
    try {
      context = new AudioContextClass({ latencyHint: "interactive" });
      master = context.createGain();
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;
      master.gain.value = state.muted ? 0 : state.volume;
      master.connect(compressor);
      compressor.connect(context.destination);
      return context;
    } catch {
      state.supported = false;
      updateControls();
      return null;
    }
  }

  function unlock() {
    state.unlocked = true;
    const audio = ensureContext();
    if (audio?.state === "suspended") audio.resume().catch(() => {});
    updateControls();
  }

  function outputFor(pan = 0) {
    if (!context || !master) return null;
    if (typeof context.createStereoPanner !== "function" || !Number.isFinite(pan) || pan === 0) return master;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(master);
    return panner;
  }

  function tone({
    frequency,
    endFrequency = frequency,
    duration = 0.1,
    delay = 0,
    gain = 0.1,
    attack = 0.006,
    type = "sine",
    pan = 0
  }) {
    if (!context) return;
    const start = context.currentTime + Math.max(0, delay) + 0.002;
    const stop = start + Math.max(0.025, duration);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), stop);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(Math.max(0.0001, gain), start + Math.min(attack, duration * 0.35));
    envelope.gain.exponentialRampToValueAtTime(0.0001, stop);
    oscillator.connect(envelope);
    envelope.connect(outputFor(pan));
    oscillator.start(start);
    oscillator.stop(stop + 0.015);
  }

  function noise({
    duration = 0.08,
    delay = 0,
    gain = 0.055,
    frequency = 900,
    endFrequency = frequency,
    type = "bandpass",
    q = type === "bandpass" ? 1.3 : 0.7,
    attack = 0.002,
    playbackRate = 1,
    pan = 0
  }) {
    if (!context) return;
    if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
      const length = Math.ceil(context.sampleRate * 0.5);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) samples[index] = Math.random() * 2 - 1;
    }
    const start = context.currentTime + Math.max(0, delay) + 0.002;
    const safeDuration = Math.min(0.45, Math.max(0.015, duration));
    const stop = start + safeDuration;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noiseBuffer;
    source.playbackRate.value = Math.max(0.35, Math.min(2.5, playbackRate));
    filter.type = type;
    filter.frequency.setValueAtTime(Math.max(60, frequency), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, endFrequency), stop);
    filter.Q.value = Math.max(0.1, q);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(
      Math.max(0.0001, gain),
      start + Math.min(Math.max(0.001, attack), safeDuration * 0.65)
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, stop);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(outputFor(pan));
    source.start(start);
    source.stop(stop + 0.015);
  }

  // Short procedural foley layers keep the download tiny while giving every
  // action its own material: air, cable, metal, paper, impact or electricity.
  function whoosh({ delay = 0, duration = 0.16, gain = 0.045, from = 420, to = 2200, pan = 0 }) {
    noise({ duration, delay, gain, frequency: from, endFrequency: to, type: "bandpass", q: 0.72, attack: duration * 0.34, pan });
    noise({ duration: duration * 0.72, delay: delay + duration * 0.08, gain: gain * 0.34, frequency: 1700, endFrequency: 5200, type: "highpass", q: 0.45, attack: duration * 0.22, pan });
  }

  function impact({ delay = 0, gain = 0.07, frequency = 145, pan = 0 }) {
    noise({ duration: 0.055, delay, gain: gain * 0.7, frequency: frequency * 2.1, endFrequency: 80, type: "lowpass", q: 0.65, attack: 0.001, pan });
    tone({ frequency, endFrequency: 48, duration: 0.105, delay, gain, attack: 0.001, type: "sine", pan });
  }

  function metalClack({ delay = 0, gain = 0.055, pan = 0, heavy = false }) {
    const weight = heavy ? 1.18 : 1;
    noise({ duration: heavy ? 0.095 : 0.055, delay, gain: gain * weight, frequency: heavy ? 620 : 1450, endFrequency: 360, type: "bandpass", q: 1.8, attack: 0.001, pan });
    [713, 1097, 1783].forEach((frequency, index) => tone({
      frequency: frequency * (heavy ? 0.72 : 1),
      endFrequency: frequency * (heavy ? 0.64 : 0.92),
      duration: (heavy ? 0.13 : 0.075) + index * 0.014,
      delay: delay + index * 0.003,
      gain: gain * (0.42 - index * 0.085),
      attack: 0.001,
      type: "sine",
      pan
    }));
  }

  function ropeTwang({ delay = 0, gain = 0.055, pan = 0, slack = false }) {
    noise({ duration: 0.035, delay, gain: gain * 0.72, frequency: 2600, endFrequency: 900, type: "highpass", q: 0.5, attack: 0.001, pan });
    tone({ frequency: slack ? 165 : 245, endFrequency: slack ? 82 : 118, duration: slack ? 0.18 : 0.145, delay: delay + 0.012, gain, attack: 0.001, type: "sawtooth", pan });
    tone({ frequency: slack ? 390 : 575, endFrequency: slack ? 205 : 315, duration: 0.105, delay: delay + 0.016, gain: gain * 0.3, attack: 0.001, type: "triangle", pan });
  }

  function rustle({ delay = 0, gain = 0.035, pan = 0, broad = false }) {
    const frequencies = broad ? [430, 920, 1650] : [850, 1450, 2350];
    frequencies.forEach((frequency, index) => noise({
      duration: 0.04 + index * 0.012,
      delay: delay + index * 0.026,
      gain: gain * (1 - index * 0.14),
      frequency,
      endFrequency: frequency * (index % 2 ? 0.7 : 1.25),
      type: "bandpass",
      q: broad ? 0.65 : 1.1,
      attack: 0.006,
      pan: Math.max(-1, Math.min(1, pan + (index - 1) * 0.08))
    }));
  }

  function electric({ delay = 0, gain = 0.055, pan = 0, long = false }) {
    const bursts = long ? 6 : 4;
    for (let index = 0; index < bursts; index += 1) {
      noise({
        duration: 0.018 + (index % 2) * 0.012,
        delay: delay + index * 0.024,
        gain: gain * (1 - index / (bursts * 1.5)),
        frequency: 2300 + (index % 3) * 1200,
        endFrequency: 900 + (index % 2) * 700,
        type: "highpass",
        q: 0.55,
        attack: 0.001,
        pan
      });
    }
    tone({ frequency: long ? 118 : 154, endFrequency: 58, duration: long ? 0.22 : 0.12, delay, gain: gain * 0.62, attack: 0.001, type: "sawtooth", pan });
  }

  function creak({ delay = 0, gain = 0.05, pan = 0, closing = false }) {
    noise({
      duration: 0.3,
      delay,
      gain,
      frequency: closing ? 680 : 230,
      endFrequency: closing ? 210 : 760,
      type: "bandpass",
      q: 3.1,
      attack: 0.07,
      playbackRate: 0.7,
      pan
    });
    tone({ frequency: closing ? 112 : 76, endFrequency: closing ? 69 : 121, duration: 0.27, delay: delay + 0.018, gain: gain * 0.38, attack: 0.045, type: "sawtooth", pan });
  }

  function synthesize(name, options = {}) {
    const pan = Math.max(-1, Math.min(1, Number(options.pan) || 0));
    switch (name) {
      case "ui":
        noise({ duration: 0.018, gain: 0.028, frequency: 3200, endFrequency: 1250, type: "highpass", q: 0.55, attack: 0.001, pan });
        tone({ frequency: 128, endFrequency: 68, duration: 0.032, gain: 0.022, attack: 0.001, type: "sine", pan });
        break;
      case "jump":
        impact({ gain: 0.038, frequency: 108, pan });
        whoosh({ delay: 0.012, duration: 0.105, gain: 0.045, from: 340, to: 1850, pan });
        rustle({ delay: 0.008, gain: 0.018, pan });
        break;
      case "double-jump":
        impact({ gain: 0.048, frequency: 126, pan });
        whoosh({ duration: 0.16, gain: 0.057, from: 270, to: 3400, pan: Math.max(-1, pan - 0.08) });
        whoosh({ delay: 0.045, duration: 0.12, gain: 0.032, from: 520, to: 4700, pan: Math.min(1, pan + 0.11) });
        break;
      case "grapple-attach":
        whoosh({ duration: 0.085, gain: 0.055, from: 760, to: 3900, pan });
        ropeTwang({ delay: 0.052, gain: 0.066, pan });
        metalClack({ delay: 0.125, gain: 0.047, pan });
        break;
      case "grapple-release":
        whoosh({ duration: 0.13, gain: 0.04, from: 2600, to: 330, pan });
        ropeTwang({ delay: 0.025, gain: 0.045, pan, slack: true });
        break;
      case "grapple-fail":
        impact({ gain: 0.095, frequency: 152, pan });
        rustle({ delay: 0.018, gain: 0.045, pan, broad: true });
        ropeTwang({ delay: 0.06, gain: 0.036, pan, slack: true });
        break;
      case "ladder-start":
        metalClack({ gain: 0.05, pan });
        metalClack({ delay: 0.075, gain: 0.036, pan: Math.min(1, pan + 0.08) });
        break;
      case "ladder-end":
        metalClack({ gain: 0.064, pan, heavy: true });
        rustle({ delay: 0.035, gain: 0.022, pan });
        break;
      case "hatch-up":
        metalClack({ gain: 0.052, pan });
        creak({ delay: 0.055, gain: 0.058, pan });
        whoosh({ delay: 0.12, duration: 0.19, gain: 0.036, from: 360, to: 2200, pan });
        break;
      case "hatch-down":
        impact({ gain: 0.074, frequency: 172, pan });
        metalClack({ delay: 0.035, gain: 0.058, pan, heavy: true });
        creak({ delay: 0.075, gain: 0.046, pan, closing: true });
        break;
      case "hatch-exit":
        rustle({ gain: 0.044, pan, broad: true });
        whoosh({ delay: 0.018, duration: 0.12, gain: 0.03, from: 480, to: 1700, pan });
        metalClack({ delay: 0.115, gain: 0.032, pan });
        break;
      case "portal":
        metalClack({ gain: 0.042, pan });
        creak({ delay: 0.035, gain: 0.045, pan });
        whoosh({ delay: 0.09, duration: 0.34, gain: 0.064, from: 3600, to: 190, pan });
        impact({ delay: 0.34, gain: 0.048, frequency: 104, pan });
        break;
      case "flag":
        rustle({ gain: 0.04, pan });
        impact({ delay: 0.035, gain: 0.045, frequency: 132, pan });
        [523, 659, 784, 1047].forEach((frequency, index) => tone({
          frequency,
          duration: 0.13,
          delay: 0.045 + index * 0.065,
          gain: 0.066,
          type: "triangle",
          pan
        }));
        break;
      case "tutorial-complete":
        rustle({ gain: 0.036, pan });
        impact({ delay: 0.055, gain: 0.055, frequency: 118, pan });
        tone({ frequency: 392, duration: 0.16, delay: 0.085, gain: 0.04, type: "triangle", pan });
        tone({ frequency: 587, duration: 0.24, delay: 0.18, gain: 0.045, type: "triangle", pan });
        break;
      case "hint":
        rustle({ gain: 0.052, pan });
        noise({ duration: 0.022, delay: 0.09, gain: 0.025, frequency: 2900, endFrequency: 1800, type: "highpass", attack: 0.001, pan });
        impact({ delay: 0.105, gain: 0.024, frequency: 94, pan });
        break;
      case "private-hint":
        whoosh({ duration: 0.24, gain: 0.035, from: 1100, to: 4300, pan });
        rustle({ delay: 0.06, gain: 0.021, pan });
        tone({ frequency: 690, endFrequency: 1240, duration: 0.24, delay: 0.035, gain: 0.034, type: "sine", pan });
        break;
      case "wisp":
        whoosh({ duration: 0.32, gain: 0.045, from: 380, to: 4800, pan });
        tone({ frequency: 540, endFrequency: 1760, duration: 0.3, gain: 0.04, type: "sine", pan });
        tone({ frequency: 1210, endFrequency: 730, duration: 0.22, delay: 0.08, gain: 0.025, type: "sine", pan: Math.min(1, pan + 0.12) });
        break;
      case "debuff-pickup":
        electric({ gain: 0.063, pan });
        impact({ delay: 0.075, gain: 0.045, frequency: 126, pan });
        break;
      case "debuff-cast":
        electric({ gain: 0.072, pan, long: true });
        whoosh({ delay: 0.035, duration: 0.18, gain: 0.045, from: 2100, to: 430, pan });
        break;
      case "debuff-hit":
        impact({ gain: 0.11, frequency: 168, pan });
        electric({ delay: 0.025, gain: 0.07, pan, long: true });
        rustle({ delay: 0.04, gain: 0.038, pan, broad: true });
        break;
      case "round-start":
        [0, 0.16, 0.32].forEach((delay, index) => {
          impact({ delay, gain: index === 2 ? 0.095 : 0.061, frequency: index === 2 ? 126 : 92, pan });
          noise({ duration: 0.035, delay, gain: index === 2 ? 0.06 : 0.038, frequency: 980, endFrequency: 330, type: "bandpass", q: 1.2, attack: 0.001, pan });
        });
        break;
      case "win":
        impact({ gain: 0.07, frequency: 122, pan });
        [392, 523, 659, 784].forEach((frequency, index) => tone({
          frequency,
          duration: index === 3 ? 0.42 : 0.18,
          delay: 0.035 + index * 0.11,
          gain: 0.075,
          type: "triangle"
        }));
        rustle({ delay: 0.34, gain: 0.034, pan, broad: true });
        break;
      case "lose":
        impact({ gain: 0.06, frequency: 102, pan });
        tone({ frequency: 294, endFrequency: 220, duration: 0.23, gain: 0.07, type: "triangle" });
        tone({ frequency: 220, endFrequency: 147, duration: 0.32, delay: 0.18, gain: 0.075, type: "triangle" });
        creak({ delay: 0.15, gain: 0.025, pan, closing: true });
        break;
      case "result":
        rustle({ gain: 0.045, pan, broad: true });
        impact({ delay: 0.065, gain: 0.072, frequency: 112, pan });
        tone({ frequency: 330, duration: 0.13, delay: 0.07, gain: 0.045, type: "triangle" });
        tone({ frequency: 494, duration: 0.25, delay: 0.15, gain: 0.052, type: "triangle" });
        break;
      case "respawn":
        whoosh({ duration: 0.28, gain: 0.064, from: 170, to: 3900, pan });
        rustle({ delay: 0.16, gain: 0.03, pan });
        impact({ delay: 0.24, gain: 0.055, frequency: 116, pan });
        break;
      default:
        return false;
    }
    return true;
  }

  function play(name, options = {}) {
    if (!state.supported || !state.unlocked || state.muted || document.hidden) return false;
    const audio = ensureContext();
    if (!audio) return false;
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const now = performance.now();
    const minimumGap = Number(options.cooldown) || cooldowns.get(name) || 80;
    if (!options.force && now - (lastPlayedAt.get(name) || -Infinity) < minimumGap) return false;
    if (!synthesize(name, options)) return false;
    lastPlayedAt.set(name, now);
    state.lastPlayed = name;
    state.playedCount += 1;
    state.history.push({ name, at: Math.round(now) });
    if (state.history.length > 32) state.history.shift();
    window.dispatchEvent(new CustomEvent("eimei-sfx-played", { detail: { name, at: now } }));
    return true;
  }

  function setMuted(value) {
    state.muted = Boolean(value);
    if (master && context) master.gain.setTargetAtTime(state.muted ? 0 : state.volume, context.currentTime, 0.015);
    saveSettings();
    updateControls();
  }

  function setVolume(value) {
    state.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (state.volume <= 0) state.muted = true;
    else if (state.muted) state.muted = false;
    if (master && context) master.gain.setTargetAtTime(state.muted ? 0 : state.volume, context.currentTime, 0.015);
    saveSettings();
    updateControls();
  }

  function updateControls() {
    if (!controls) return;
    const button = controls.querySelector("button");
    const slider = controls.querySelector("input");
    button.disabled = !state.supported;
    button.textContent = !state.supported ? "音 --" : state.muted ? "音 OFF" : "音 ON";
    button.setAttribute("aria-pressed", String(state.muted));
    button.title = !state.supported ? "このブラウザでは効果音を再生できません" : state.muted ? "効果音をオンにする" : "効果音をミュートする";
    slider.disabled = !state.supported;
    slider.value = String(Math.round(state.volume * 100));
  }

  function installControls() {
    if (previewDocument || controls || !document.documentElement) return;
    const style = document.createElement("style");
    style.dataset.eimeiGame = "sfx-style";
    style.textContent = `
      .eimei-sfx-controls{position:fixed;left:12px;bottom:12px;z-index:2147483638;display:flex;align-items:center;gap:7px;padding:5px 7px;background:rgba(251,249,242,.92);border:1px solid rgba(22,40,67,.5);box-shadow:3px 3px 0 rgba(22,40,67,.12);font:600 12px/1 system-ui,sans-serif;color:#162843;pointer-events:auto;transform:none!important;zoom:1!important}
      .eimei-sfx-controls button{min-width:52px;padding:6px 7px;border:0;background:#162843;color:#fff;font:inherit;cursor:pointer}
      .eimei-sfx-controls button[aria-pressed="true"]{background:#686868}
      .eimei-sfx-controls input{width:62px;height:18px;margin:0;accent-color:#d09220;cursor:pointer}
      .eimei-sfx-controls button:focus-visible,.eimei-sfx-controls input:focus-visible{outline:2px solid #d09220;outline-offset:2px}
      @media (max-width:640px){.eimei-sfx-controls{left:7px;bottom:7px}.eimei-sfx-controls input{width:48px}}
    `;
    const root = document.createElement("div");
    root.className = "eimei-sfx-controls";
    root.dataset.eimeiGame = "sfx-controls";
    root.setAttribute("aria-label", "効果音設定");
    root.innerHTML = `<button type="button"></button><input type="range" min="0" max="100" step="5" aria-label="効果音の音量">`;
    root.addEventListener("keydown", (event) => event.stopPropagation());
    root.addEventListener("keyup", (event) => event.stopPropagation());
    root.querySelector("button").addEventListener("click", () => {
      const nextMuted = !state.muted;
      setMuted(nextMuted);
      if (!nextMuted) play("ui", { force: true });
    });
    root.querySelector("input").addEventListener("input", (event) => setVolume(Number(event.currentTarget.value) / 100));
    document.documentElement.append(style, root);
    controls = root;
    updateControls();
  }

  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("touchstart", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".eimei-sfx-controls")) return;
    const control = event.target.closest?.("button, input[type='button'], input[type='submit'], a[href]");
    if (control && !control.disabled) play("ui");
  });

  window.EimeiSfx = {
    ...state,
    play,
    unlock,
    setMuted,
    setVolume,
    getState: () => ({
      supported: state.supported,
      unlocked: state.unlocked,
      muted: state.muted,
      volume: state.volume,
      lastPlayed: state.lastPlayed,
      playedCount: state.playedCount,
      history: state.history.slice()
    })
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installControls, { once: true });
  else installControls();
})();

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

  function noise({ duration = 0.08, delay = 0, gain = 0.055, frequency = 900, type = "bandpass", pan = 0 }) {
    if (!context) return;
    if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
      const length = Math.ceil(context.sampleRate * 0.22);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) samples[index] = Math.random() * 2 - 1;
    }
    const start = context.currentTime + Math.max(0, delay) + 0.002;
    const stop = start + Math.min(0.2, Math.max(0.025, duration));
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = type;
    filter.frequency.value = Math.max(60, frequency);
    filter.Q.value = type === "bandpass" ? 1.3 : 0.7;
    envelope.gain.setValueAtTime(Math.max(0.0001, gain), start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, stop);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(outputFor(pan));
    source.start(start);
    source.stop(stop + 0.015);
  }

  function synthesize(name, options = {}) {
    const pan = Math.max(-1, Math.min(1, Number(options.pan) || 0));
    switch (name) {
      case "ui":
        tone({ frequency: 520, endFrequency: 610, duration: 0.045, gain: 0.045, type: "triangle", pan });
        break;
      case "jump":
        tone({ frequency: 245, endFrequency: 410, duration: 0.09, gain: 0.09, type: "triangle", pan });
        break;
      case "double-jump":
        tone({ frequency: 330, endFrequency: 690, duration: 0.14, gain: 0.09, type: "triangle", pan });
        noise({ duration: 0.07, gain: 0.022, frequency: 1800, pan });
        break;
      case "grapple-attach":
        noise({ duration: 0.045, gain: 0.055, frequency: 2200, pan });
        tone({ frequency: 720, endFrequency: 285, duration: 0.12, gain: 0.07, type: "triangle", pan });
        break;
      case "grapple-release":
        tone({ frequency: 310, endFrequency: 185, duration: 0.09, gain: 0.055, type: "sine", pan });
        break;
      case "grapple-fail":
        noise({ duration: 0.12, gain: 0.06, frequency: 260, type: "lowpass", pan });
        tone({ frequency: 175, endFrequency: 72, duration: 0.2, gain: 0.095, type: "sawtooth", pan });
        break;
      case "ladder-start":
        tone({ frequency: 260, endFrequency: 310, duration: 0.055, gain: 0.055, type: "square", pan });
        tone({ frequency: 390, duration: 0.05, delay: 0.055, gain: 0.045, type: "square", pan });
        break;
      case "ladder-end":
        tone({ frequency: 390, endFrequency: 520, duration: 0.11, gain: 0.065, type: "triangle", pan });
        break;
      case "hatch-up":
        noise({ duration: 0.12, gain: 0.06, frequency: 430, type: "lowpass", pan });
        tone({ frequency: 125, endFrequency: 225, duration: 0.24, gain: 0.085, type: "triangle", pan });
        break;
      case "hatch-down":
        noise({ duration: 0.1, gain: 0.065, frequency: 360, type: "lowpass", pan });
        tone({ frequency: 190, endFrequency: 82, duration: 0.2, gain: 0.08, type: "triangle", pan });
        break;
      case "hatch-exit":
        noise({ duration: 0.07, gain: 0.04, frequency: 1200, pan });
        tone({ frequency: 215, endFrequency: 410, duration: 0.13, gain: 0.065, type: "triangle", pan });
        break;
      case "portal":
        tone({ frequency: 220, endFrequency: 330, duration: 0.28, gain: 0.075, type: "sine", pan });
        tone({ frequency: 440, endFrequency: 660, duration: 0.3, delay: 0.06, gain: 0.055, type: "sine", pan });
        break;
      case "flag":
      case "tutorial-complete":
        [523, 659, 784, 1047].forEach((frequency, index) => tone({
          frequency,
          duration: 0.13,
          delay: index * 0.065,
          gain: name === "flag" ? 0.07 : 0.055,
          type: "triangle",
          pan
        }));
        break;
      case "hint":
        tone({ frequency: 587, duration: 0.15, gain: 0.055, type: "sine", pan });
        tone({ frequency: 880, duration: 0.18, delay: 0.09, gain: 0.05, type: "sine", pan });
        break;
      case "private-hint":
      case "wisp":
        tone({ frequency: 740, endFrequency: 1180, duration: 0.22, gain: 0.055, type: "sine", pan });
        tone({ frequency: 1110, endFrequency: 1480, duration: 0.18, delay: 0.055, gain: 0.035, type: "sine", pan });
        break;
      case "debuff-pickup":
      case "debuff-cast":
        tone({ frequency: 180, endFrequency: 360, duration: 0.18, gain: 0.07, type: "square", pan });
        noise({ duration: 0.1, delay: 0.04, gain: 0.035, frequency: 650, pan });
        break;
      case "debuff-hit":
        tone({ frequency: 150, endFrequency: 65, duration: 0.32, gain: 0.105, type: "sawtooth", pan });
        noise({ duration: 0.15, gain: 0.055, frequency: 240, type: "lowpass", pan });
        break;
      case "round-start":
        [440, 440, 880].forEach((frequency, index) => tone({
          frequency,
          duration: index === 2 ? 0.24 : 0.1,
          delay: index * 0.15,
          gain: index === 2 ? 0.08 : 0.06,
          type: "square"
        }));
        break;
      case "win":
        [392, 523, 659, 784].forEach((frequency, index) => tone({
          frequency,
          duration: index === 3 ? 0.42 : 0.18,
          delay: index * 0.11,
          gain: 0.075,
          type: "triangle"
        }));
        break;
      case "lose":
        tone({ frequency: 294, endFrequency: 220, duration: 0.23, gain: 0.07, type: "triangle" });
        tone({ frequency: 220, endFrequency: 147, duration: 0.32, delay: 0.18, gain: 0.075, type: "triangle" });
        break;
      case "result":
        tone({ frequency: 330, duration: 0.13, gain: 0.06, type: "triangle" });
        tone({ frequency: 494, duration: 0.25, delay: 0.1, gain: 0.065, type: "triangle" });
        break;
      case "respawn":
        tone({ frequency: 180, endFrequency: 520, duration: 0.28, gain: 0.07, type: "sine", pan });
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

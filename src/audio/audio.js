// Audio: streamed CC-BY music via HTMLAudio, WebAudio SFX buffers, synthesized breathing loop.
const SFX = {
  grab_0: 'assets/audio/grab_0.ogg',
  grab_1: 'assets/audio/grab_1.ogg',
  grab_2: 'assets/audio/grab_2.ogg',
  clunk_0: 'assets/audio/clunk_0.ogg',
  clunk_1: 'assets/audio/clunk_1.ogg',
  impact_hard: 'assets/audio/impact_hard.ogg',
  discovery: 'assets/audio/discovery.ogg',
  ui_tick: 'assets/audio/ui_tick.ogg',
  warn: 'assets/audio/warn.ogg',
  join: 'assets/audio/join.ogg',
  leave: 'assets/audio/leave.ogg',
  radio_blip: 'assets/audio/radio_blip.ogg',
  refill: 'assets/audio/refill.ogg',
  servo: 'assets/audio/servo.ogg',
  thruster: 'assets/audio/thruster.ogg',
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxGain = null;
  const buffers = {};
  let music = null;
  let musicVol = 0.35;
  let masterVol = 0.7;
  let thrusterSrc = null;
  let thrusterGain = null;
  let breath = null;
  let started = false;

  async function init() {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = masterVol;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);

    music = new Audio('assets/audio/music_frozen_star.mp3');
    music.loop = true;
    music.volume = musicVol * masterVol;
    music.play().catch(() => {});

    startBreathing();

    await Promise.all(Object.entries(SFX).map(async ([name, url]) => {
      try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        buffers[name] = await ctx.decodeAudioData(arr);
      } catch (e) { /* missing sfx stays silent */ }
    }));
  }

  function play(name, { pitch = 1, vol = 1 } = {}) {
    if (!ctx || !buffers[name]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = pitch;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(sfxGain);
    src.start();
  }

  function playGrab() { play('grab_' + ((Math.random() * 3) | 0), { pitch: 0.9 + Math.random() * 0.2, vol: 0.7 }); }
  function playClunk(hard) {
    if (hard) play('impact_hard', { pitch: 0.95 + Math.random() * 0.1 });
    else play('clunk_' + ((Math.random() * 2) | 0), { pitch: 0.9 + Math.random() * 0.2, vol: 0.8 });
  }

  function setThruster(on) {
    if (!ctx || !buffers.thruster) return;
    if (on && !thrusterSrc) {
      thrusterSrc = ctx.createBufferSource();
      thrusterSrc.buffer = buffers.thruster;
      thrusterSrc.loop = true;
      thrusterGain = ctx.createGain();
      thrusterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      thrusterGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.15);
      thrusterSrc.connect(thrusterGain).connect(sfxGain);
      thrusterSrc.start();
    } else if (!on && thrusterSrc) {
      const src = thrusterSrc, g = thrusterGain;
      thrusterSrc = null;
      thrusterGain = null;
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      setTimeout(() => { try { src.stop(); } catch (e) { /* done */ } }, 300);
    }
  }

  function startBreathing() {
    const len = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 850;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.22;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.028;
    lfo.connect(lfoGain).connect(g.gain);
    const base = ctx.createConstantSource();
    base.offset.value = 0.03;
    base.connect(g.gain);
    src.connect(bp).connect(g).connect(master);
    src.start();
    lfo.start();
    base.start();
    breath = { lfo, lfoGain, base, bp };
  }

  function setBreathStress(s) {
    if (!breath) return;
    breath.lfo.frequency.value = 0.22 + s * 0.35;
    breath.base.offset.value = 0.03 + s * 0.05;
    breath.lfoGain.gain.value = 0.028 + s * 0.05;
    breath.bp.frequency.value = 850 + s * 500;
  }

  function setVolume(v) {
    masterVol = v;
    if (master) master.gain.value = v;
    if (music) music.volume = musicVol * v;
  }

  return { init, play, playGrab, playClunk, setThruster, setBreathStress, setVolume, get started() { return started; } };
}

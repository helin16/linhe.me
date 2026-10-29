// Sound effects (research R14, FR-024), all made here with Web Audio (no audio files): a thump on firing, an engine
// rumble while a tank drives, a boom per blast, a clunk when a crate lands, and a tune at the end. The audio context
// starts on the first tap or key press (browsers require one); one master gain does the muting.

const VOLUME = 0.6;

export function createSound(muted: boolean) {
  let ac: AudioContext | undefined, master: GainNode, noise: AudioBuffer, engineGain: GainNode | undefined;
  let isMuted = muted;
  function start() {
    if (ac) return;
    const a = ac = new AudioContext();
    master = a.createGain(); master.gain.value = isMuted ? 0 : VOLUME; master.connect(a.destination);
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the engine: a low sawtooth with a little wobble, silent until a tank drives
    const osc = a.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
    const wobble = a.createOscillator(); wobble.frequency.value = 9;
    const depth = a.createGain(); depth.gain.value = 6; wobble.connect(depth).connect(osc.frequency);
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    engineGain = a.createGain(); engineGain.gain.value = 0;
    osc.connect(lp).connect(engineGain).connect(master); osc.start(); wobble.start();
  }
  addEventListener('pointerdown', start, { once: true });
  addEventListener('keydown', start, { once: true });

  type Burst = { dur: number; from: number; to: number; vol: number };
  function burst({ dur, from, to, vol }: Burst) { // filtered noise, the filter closing as it fades
    if (!ac) return;
    const t = ac.currentTime, src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; lp.type = 'lowpass';
    lp.frequency.setValueAtTime(from, t); lp.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(g).connect(master); src.start(t); src.stop(t + dur);
  }
  function tone(f: number, dur: number, { type = 'square' as OscillatorType, vol = 0.12, to = 0, delay = 0 } = {}) {
    if (!ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  }

  return {
    fire: () => { burst({ dur: 0.25, from: 1800, to: 120, vol: 0.5 }); tone(140, 0.2, { type: 'sine', to: 50, vol: 0.4 }); },
    /** The engine rumble on or off (faded, so it doesn't click). */
    engine(on: boolean) { if (ac && engineGain) engineGain.gain.setTargetAtTime(on ? 0.25 : 0, ac.currentTime, 0.08); },
    boom: (r: number) => { burst({ dur: 0.9, from: 2600, to: 60, vol: Math.min(1, r / 40) * 0.9 }); tone(70, 0.6, { type: 'sine', to: 30, vol: 0.5 }); },
    crateLand: () => { burst({ dur: 0.12, from: 900, to: 200, vol: 0.4 }); tone(180, 0.12, { type: 'triangle', vol: 0.25 }); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { delay: i * 0.16 })),
    lose: () => [440, 370, 311].forEach((f, i) => tone(f, 0.4, { type: 'triangle', delay: i * 0.22 })),
    setMuted(m: boolean) { isMuted = m; if (ac) master.gain.value = m ? 0 : VOLUME; },
    dispose() { removeEventListener('pointerdown', start); removeEventListener('keydown', start); void ac?.close(); },
  };
}
export type Sound = ReturnType<typeof createSound>;

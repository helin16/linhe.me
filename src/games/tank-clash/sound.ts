// Sound effects (research R14, FR-024). Normal style: recorded clips for firing, driving, blasts, a tank destroyed by
// a blast, winning and losing (from freesound.org; credits in the garage), a made-here clunk for a crate landing, and
// made-here stand-ins until a clip has loaded. Arcade style: everything made here, retro (square waves and crunchy
// noise). The audio context starts on the first tap or key press (browsers require one); one master gain mutes.
import { Style } from './enums.ts';
import destroyedUrl from './sounds/destroyed.mp3';
import explosionUrl from './sounds/explosion.mp3';
import fireUrl from './sounds/fire.mp3';
import lostUrl from './sounds/lost.mp3';
import moveUrl from './sounds/move.mp3';
import wonUrl from './sounds/won.mp3';

const VOLUME = 0.6;
const ENGINE_VOL = 0.25, MOVE_CLIP_VOL = 0.7, ARCADE_ENGINE_VOL = 0.3; // the engine's level: made here, the clip, arcade
const CLIPS = { shot: fireUrl, drive: moveUrl, blast: explosionUrl, kill: destroyedUrl, won: wonUrl, lost: lostUrl };
type Clip = keyof typeof CLIPS;

export function createSound(muted: boolean, style: Style) {
  let ac: AudioContext | undefined, master: GainNode, noise: AudioBuffer, crunch: AudioBuffer, engineGain: GainNode | undefined, engineVol = ENGINE_VOL;
  let arcEngine: GainNode | undefined, arcade = style === Style.Arcade, engineOn = false;
  const clips: Partial<Record<Clip, AudioBuffer>> = {};
  let isMuted = muted;
  function start() {
    if (ac) return;
    const a = ac = new AudioContext();
    master = a.createGain(); master.gain.value = isMuted ? 0 : VOLUME; master.connect(a.destination);
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // arcade noise: held for 8 samples at a time, so it crunches
    crunch = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const c = crunch.getChannelData(0);
    for (let i = 0; i < c.length; i += 8) c.fill(Math.random() * 2 - 1, i, i + 8);
    // the arcade engine: a low square wave chugging on and off
    const sq = a.createOscillator(); sq.type = 'square'; sq.frequency.value = 48;
    const chug = a.createOscillator(); chug.type = 'square'; chug.frequency.value = 14;
    const chugDepth = a.createGain(); chugDepth.gain.value = 0.5;
    const sqLp = a.createBiquadFilter(); sqLp.type = 'lowpass'; sqLp.frequency.value = 650;
    const amp = a.createGain(); amp.gain.value = 0.5; chug.connect(chugDepth).connect(amp.gain);
    arcEngine = a.createGain(); arcEngine.gain.value = 0;
    sq.connect(sqLp).connect(amp).connect(arcEngine).connect(master); sq.start(); chug.start();
    // the engine: a low sawtooth with a little wobble, silent until a tank drives
    const osc = a.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
    const wobble = a.createOscillator(); wobble.frequency.value = 9;
    const depth = a.createGain(); depth.gain.value = 6; wobble.connect(depth).connect(osc.frequency);
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    engineGain = a.createGain(); engineGain.gain.value = 0;
    osc.connect(lp).connect(engineGain).connect(master); osc.start(); wobble.start();
    for (const [name, url] of Object.entries(CLIPS) as [Clip, string][]) {
      fetch(url).then(r => r.arrayBuffer()).then(data => a.decodeAudioData(data)).then(buf => {
        clips[name] = buf;
        if (name !== 'drive' || !engineGain) return; // (engineGain is set by now; the check narrows its type)
        // the recorded engine takes over from the made-here one: it loops all the time, heard only while driving
        osc.stop(); wobble.stop();
        const src = a.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(engineGain); src.start();
        engineVol = MOVE_CLIP_VOL; engine(engineOn);
      }).catch(() => { /* not loaded: the made-here sound stays */ });
    }
  }
  addEventListener('pointerdown', start, { once: true });
  addEventListener('keydown', start, { once: true });

  type Burst = { dur: number; from: number; to: number; vol: number; delay?: number; gritty?: boolean };
  function burst({ dur, from, to, vol, delay = 0, gritty = false }: Burst) { // filtered noise, the filter closing as it fades
    if (!ac) return;
    const t = ac.currentTime + delay, src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = gritty ? crunch : noise; lp.type = 'lowpass';
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

  /** Plays a loaded clip; false if it isn't loaded (yet). */
  function clip(name: Clip, vol = 1) {
    const buf = clips[name];
    if (!ac || !buf) return false;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; g.gain.value = vol;
    src.connect(g).connect(master); src.start();
    return true;
  }
  /** A melody of [frequency, seconds] notes (0: a rest), with a triangle an octave down. */
  const tune = (notes: [number, number][], bass = true) => notes.reduce((t, [f, d]) => {
    if (f) { tone(f, d * 0.95, { vol: 0.14, delay: t }); if (bass) tone(f / 2, d * 0.95, { type: 'triangle', vol: 0.12, delay: t }); }
    return t + d;
  }, 0);
  const normalBoom = (r: number) => {
    const vol = Math.min(1, r / 40);
    if (!clip('blast', vol)) { burst({ dur: 0.9, from: 2600, to: 60, vol: vol * 0.9 }); tone(70, 0.6, { type: 'sine', to: 30, vol: 0.5 }); }
  };
  const arcadeBoom = (r: number) => {
    const vol = Math.min(1, r / 40);
    burst({ dur: 1.1, from: 3200, to: 70, vol, gritty: true }); tone(95, 0.7, { to: 30, vol: 0.3 * vol });
    burst({ dur: 0.5, from: 1200, to: 60, vol: 0.6 * vol, delay: 0.25, gritty: true });
  };
  function engine(on: boolean) {
    engineOn = on;
    if (!ac || !engineGain || !arcEngine) return;
    engineGain.gain.setTargetAtTime(on && !arcade ? engineVol : 0, ac.currentTime, 0.08);
    arcEngine.gain.setTargetAtTime(on && arcade ? ARCADE_ENGINE_VOL : 0, ac.currentTime, 0.05);
  }

  return {
    fire: () => {
      if (arcade) { tone(900, 0.18, { to: 80, vol: 0.22 }); burst({ dur: 0.15, from: 5000, to: 400, vol: 0.5, gritty: true }); return; }
      if (!clip('shot')) { burst({ dur: 0.25, from: 1800, to: 120, vol: 0.5 }); tone(140, 0.2, { type: 'sine', to: 50, vol: 0.4 }); }
    },
    /** The engine rumble on or off (faded, so it doesn't click). */
    engine,
    /** A blast of radius r (a bigger one is louder). */
    boom: (r: number) => arcade ? arcadeBoom(r) : normalBoom(r),
    /** A tank destroyed by a blast: a bigger explosion, burning. */
    destroyed: () => {
      if (arcade) { arcadeBoom(40); tune([[220, 0.08], [165, 0.08], [110, 0.2]], false); return; }
      if (!clip('kill')) normalBoom(40);
    },
    crateLand: () => {
      if (arcade) { tone(330, 0.07, { vol: 0.18 }); tone(220, 0.1, { vol: 0.18, delay: 0.07 }); burst({ dur: 0.08, from: 2000, to: 300, vol: 0.4, gritty: true }); return; }
      burst({ dur: 0.12, from: 900, to: 200, vol: 0.4 }); tone(180, 0.12, { type: 'triangle', vol: 0.25 });
    },
    win: () => {
      if (arcade) { tune([[523, 0.1], [523, 0.1], [523, 0.1], [659, 0.3], [0, 0.08], [587, 0.1], [659, 0.1], [784, 0.45]]); return; }
      if (!clip('won')) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { delay: i * 0.16 }));
    },
    lose: () => {
      if (arcade) { tune([[392, 0.22], [370, 0.22], [349, 0.22], [330, 0.6]], false); return; }
      if (!clip('lost')) [440, 370, 311].forEach((f, i) => tone(f, 0.4, { type: 'triangle', delay: i * 0.22 }));
    },
    /** Switches between the normal (recorded) and arcade (retro) sounds. */
    setStyle(s: Style) { arcade = s === Style.Arcade; engine(engineOn); },
    setMuted(m: boolean) { isMuted = m; if (ac) master.gain.value = m ? 0 : VOLUME; },
    dispose() { removeEventListener('pointerdown', start); removeEventListener('keydown', start); void ac?.close(); },
  };
}
export type Sound = ReturnType<typeof createSound>;

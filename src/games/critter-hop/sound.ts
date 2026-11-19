// Short made-here blips (research R10): a tap, a jump, a creature arriving home, and a fanfare for finishing. The audio
// context starts on the first tap or key press (browsers require one); one gain mutes. Browser-only: covered by e2e.

const VOLUME = 0.25;
type Note = [freq: number, at: number, dur: number];
const TUNES = {
  tap: [[660, 0, 0.06]] as Note[],
  jump: [[440, 0, 0.05], [660, 0.04, 0.05]] as Note[],
  arrive: [[523, 0, 0.08], [784, 0.08, 0.12]] as Note[],
  fanfare: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3]] as Note[],
};
type Tune = keyof typeof TUNES;

export function createSound(muted: boolean) {
  let ac: AudioContext | undefined, master: GainNode | undefined, isMuted = muted;
  const start = () => {
    if (ac) return;
    ac = new AudioContext();
    master = ac.createGain(); master.gain.value = isMuted ? 0 : VOLUME; master.connect(ac.destination);
  };
  addEventListener('pointerdown', start, { once: true });
  addEventListener('keydown', start, { once: true });
  return {
    play(tune: Tune) {
      if (!ac || !master || isMuted) return;
      const t0 = ac.currentTime;
      for (const [freq, at, dur] of TUNES[tune]) {
        const osc = ac.createOscillator(), env = ac.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        env.gain.setValueAtTime(0.0001, t0 + at);
        env.gain.exponentialRampToValueAtTime(1, t0 + at + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        osc.connect(env).connect(master);
        osc.start(t0 + at); osc.stop(t0 + at + dur + 0.02);
      }
    },
    setMuted(m: boolean) { isMuted = m; if (master) master.gain.value = m ? 0 : VOLUME; },
    dispose() { removeEventListener('pointerdown', start); removeEventListener('keydown', start); void ac?.close(); },
  };
}

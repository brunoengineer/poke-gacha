// Music: a step sequencer that schedules notes slightly ahead on the AudioContext clock (tight timing even
// when the main thread is busy), looping each track's sections. Tracks crossfade; null fades out.

import { musicAllowed, onAudioChange, onUnlock, readyContext } from './engine';
import { playDrum, playNote } from './instruments';
import { parseLine, type ScoreEvent } from './score';
import { TRACKS, type TrackDef } from './tracks';
import type { MusicTrack } from './types';

const LOOKAHEAD = 0.15;
const TICK_MS = 25;

type Channel = 'lead' | 'harm' | 'bass' | 'drums';
interface Compiled {
  length: number;
  steps: { ch: Channel; ev: ScoreEvent }[][];
}

const compiled = new Map<MusicTrack, Compiled[]>();

function compile(name: MusicTrack): Compiled[] {
  let sections = compiled.get(name);
  if (sections) return sections;
  sections = TRACKS[name].loop.map(section => {
    const lines = (['lead', 'harm', 'bass', 'drums'] as Channel[])
      .filter(ch => section[ch])
      .map(ch => ({ ch, line: parseLine(section[ch]!, ch === 'drums') }));
    const length = Math.max(16, ...lines.map(l => l.line.length));
    const steps: Compiled['steps'] = Array.from({ length }, () => []);
    for (const { ch, line } of lines) for (const ev of line.events) steps[ev.at % length].push({ ch, ev });
    return { length, steps };
  });
  compiled.set(name, sections);
  return sections;
}

class Player {
  private readonly out: GainNode;
  private readonly echoIn: GainNode | null = null;
  private readonly nodes: AudioNode[] = [];
  private readonly sections: Compiled[];
  private readonly step: number;
  private section = 0;
  private pos = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly c: AudioContext, dest: AudioNode, readonly name: MusicTrack, private readonly def: TrackDef) {
    this.sections = compile(name);
    this.step = 60 / def.bpm / 4;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    if (def.echo) {
      // Lead echo: a feedback delay, panned slightly to the right for width.
      const input = c.createGain();
      const delay = c.createDelay(1);
      const feedback = c.createGain();
      const wet = c.createGain();
      delay.delayTime.value = Math.min(0.95, def.echo.steps * this.step);
      feedback.gain.value = def.echo.feedback;
      wet.gain.value = def.echo.wet;
      input.connect(delay);
      delay.connect(feedback).connect(delay);
      let tail: AudioNode = delay.connect(wet);
      if ('createStereoPanner' in c) {
        const pan = c.createStereoPanner();
        pan.pan.value = 0.35;
        tail = tail.connect(pan);
        this.nodes.push(pan);
      }
      tail.connect(this.out);
      this.echoIn = input;
      this.nodes.push(input, delay, feedback, wet);
    }
  }

  start(fadeIn: number) {
    const now = this.c.currentTime;
    this.next = now + 0.06;
    const g = this.out.gain;
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(1, now + fadeIn);
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(fadeOut: number) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const now = this.c.currentTime;
    const g = this.out.gain;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fadeOut);
    } catch { /* ignore */ }
    setTimeout(() => {
      this.out.disconnect();
      this.nodes.forEach(n => n.disconnect());
    }, (fadeOut + LOOKAHEAD) * 1000 + 300);
  }

  private tick() {
    try {
      const now = this.c.currentTime;
      // After a stall (busy thread, suspended tab) skip ahead instead of rushing to catch up.
      if (this.next < now - 0.1) this.next = now + 0.05;
      while (this.next < now + LOOKAHEAD) {
        this.playStep(this.next);
        this.advance();
      }
    } catch { /* never let a scheduling error kill the app */ }
  }

  private playStep(time: number) {
    const def = this.def;
    const t = this.pos % 2 ? time + (def.swing ?? 0) * this.step : time;
    for (const { ch, ev } of this.sections[this.section].steps[this.pos]) {
      if (ch === 'drums') {
        for (const hit of ev.hits) playDrum(this.c, this.out, t, hit, def.drumVol);
      } else {
        playNote(this.c, this.out, t, ev, def[ch], this.step, def.arpRate);
        if (ch === 'lead' && this.echoIn) playNote(this.c, this.echoIn, t, ev, def.lead, this.step, def.arpRate);
      }
    }
  }

  private advance() {
    this.next += this.step;
    this.pos++;
    if (this.pos >= this.sections[this.section].length) {
      this.pos = 0;
      this.section = (this.section + 1) % this.sections.length;
    }
  }
}

/** Dev/test helper: schedules one section of a track at once (offline rendering); returns its duration. */
export function renderSection(c: BaseAudioContext, out: AudioNode, name: MusicTrack, index = 0, t0 = 0): number {
  const def = TRACKS[name];
  const section = compile(name)[index];
  const step = 60 / def.bpm / 4;
  section.steps.forEach((events, pos) => {
    const t = t0 + pos * step + (pos % 2 ? (def.swing ?? 0) * step : 0);
    for (const { ch, ev } of events) {
      if (ch === 'drums') ev.hits.forEach(hit => playDrum(c, out, t, hit, def.drumVol));
      else playNote(c, out, t, ev, def[ch], step, def.arpRate);
    }
  });
  return section.length * step;
}

let desired: MusicTrack | null = null;
let player: Player | null = null;

/** Starts, switches or stops the actual player to match the requested track and the settings. */
function sync() {
  const ready = readyContext();
  if (!ready) return;
  const want = musicAllowed() ? desired : null;
  if (player?.name === want) return;
  const crossfade = !!player;
  player?.stop(crossfade && want ? 0.9 : 0.6);
  player = null;
  if (!want) return;
  try {
    player = new Player(ready.c, ready.buses.music, want, TRACKS[want]);
    player.start(crossfade ? 0.8 : 0.5);
  } catch {
    player = null;
  }
}

export function playMusic(track: MusicTrack | null): void {
  if (track === desired) return;
  desired = track;
  sync();
}

export const currentMusic = () => desired;

onUnlock(sync);
onAudioChange(sync);

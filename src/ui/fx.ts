// Shared visual effects: skippable animation sequences and particles.

import { fxSpeed, reducedMotion } from './dom';

/**
 * Chains animations (Web Animations API) with `await`.
 * `skip()` finishes everything running and makes the next steps resolve immediately.
 * Durations and delays are scaled by the "fast effects" setting.
 */
export class Sequence {
  skipped = reducedMotion();
  private running = new Set<Animation>();
  private waits = new Set<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }>();

  anim(node: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions = {}): Promise<void> {
    if (this.skipped) return Promise.resolve();
    const speed = fxSpeed();
    const animation = node.animate(keyframes, {
      fill: 'both',
      ...options,
      duration: Number(options.duration ?? 300) * speed,
      delay: Number(options.delay ?? 0) * speed,
    });
    this.running.add(animation);
    return animation.finished.then(() => {}, () => {}).finally(() => this.running.delete(animation));
  }

  wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise(resolve => {
      const entry = { resolve, timer: setTimeout(() => { this.waits.delete(entry); resolve(); }, ms * fxSpeed()) };
      this.waits.add(entry);
    });
  }

  skip() {
    if (this.skipped) return;
    this.skipped = true;
    this.running.forEach(animation => animation.finish());
    this.waits.forEach(({ resolve, timer }) => { clearTimeout(timer); resolve(); });
    this.waits.clear();
  }
}

/** Burst (or implosion, with `inward`) of particles from the center of `host`. */
export function burst(host: Element | null, { color = '#f4dca3', count = 24, distance = 180, duration = 900, inward = false, shape = 'dot' }: {
  color?: string;
  count?: number;
  distance?: number;
  duration?: number;
  inward?: boolean;
  /** 'dot' (round) or 'star' (four-pointed sparkle, for shinies). */
  shape?: 'dot' | 'star';
} = {}) {
  if (reducedMotion() || !host?.isConnected) return;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('i');
    const size = (shape === 'star' ? 8 : 3) + Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    const reach = distance * (0.45 + Math.random() * 0.75);
    particle.className = `particle${shape === 'star' ? ' particle-star' : ''}`;
    particle.style.cssText = `width:${size}px;height:${size}px;color:${color}`;
    host.append(particle);

    const far = `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach}px) scale(${inward ? 1 : 0.2})`;
    const near = 'translate(0, 0) scale(1)';
    particle.animate(
      [{ transform: inward ? far : near, opacity: inward ? 0 : 1 }, { transform: inward ? near : far, opacity: inward ? 1 : 0 }],
      {
        duration: duration * (0.65 + Math.random() * 0.5) * fxSpeed(),
        delay: Math.random() * (inward ? 450 : 90),
        easing: inward ? 'cubic-bezier(.55,0,.9,.45)' : 'cubic-bezier(.1,.8,.3,1)',
        fill: 'backwards',
      },
    ).finished.then(() => particle.remove(), () => particle.remove());
  }
}

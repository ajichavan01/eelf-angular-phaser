import { FIXED_STEP } from './GameParameters.ts';
import { clamp } from './Utilities.ts';

export class FixedStepClock {
  private remainder = 0;

  advance(elapsedSeconds: number, speed: number, step: () => void): number {
    if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(speed)) return 0;
    this.remainder += clamp(elapsedSeconds, 0, 0.25) * clamp(speed, 0, 4);
    let steps = 0;
    while (this.remainder + 1e-10 >= FIXED_STEP && steps < 30) {
      step();
      this.remainder = Math.max(0, this.remainder - FIXED_STEP);
      steps++;
    }
    return steps;
  }

  reset(): void { this.remainder = 0; }
}
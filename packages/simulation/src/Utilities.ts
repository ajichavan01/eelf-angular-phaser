export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

export const distanceSquared = (left: { x: number; y: number }, right: { x: number; y: number }): number =>
  (left.x - right.x) ** 2 + (left.y - right.y) ** 2;

export class Random {
  state: number;

  constructor(state: number) {
    this.state = state >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  between(minimum: number, maximum: number): number {
    return minimum + this.next() * (maximum - minimum);
  }
}
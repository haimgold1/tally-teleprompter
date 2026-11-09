import { describe, expect, it } from 'vitest';
import { advanceOffset, clampWpm, pxPerSecond, readSeconds, remainingSeconds } from './wpm';

describe('readSeconds', () => {
  it('converts words and wpm to seconds', () => {
    expect(readSeconds(140, 140)).toBe(60);
    expect(readSeconds(70, 140)).toBe(30);
    expect(readSeconds(300, 60)).toBe(300);
  });
  it('is zero for empty input', () => {
    expect(readSeconds(0, 140)).toBe(0);
    expect(readSeconds(100, 0)).toBe(0);
  });
});

describe('pxPerSecond', () => {
  it('is height divided by reading time', () => {
    expect(pxPerSecond(6000, 140, 140)).toBe(100);
    expect(pxPerSecond(1000, 100, 200)).toBeCloseTo(33.333, 2);
  });
  it('doubles when wpm doubles', () => {
    expect(pxPerSecond(5000, 500, 200)).toBeCloseTo(pxPerSecond(5000, 500, 100) * 2, 8);
  });
  it('scrolls the whole text in exactly the reading time', () => {
    const height = 12345;
    const speed = pxPerSecond(height, 777, 163);
    expect(speed * readSeconds(777, 163)).toBeCloseTo(height, 6);
  });
  it('never divides by zero', () => {
    expect(pxPerSecond(1000, 0, 140)).toBe(0);
    expect(pxPerSecond(0, 100, 140)).toBe(0);
  });
});

describe('remainingSeconds', () => {
  it('counts down with the offset', () => {
    expect(remainingSeconds(0, 6000, 140, 140)).toBeCloseTo(60);
    expect(remainingSeconds(3000, 6000, 140, 140)).toBeCloseTo(30);
    expect(remainingSeconds(6000, 6000, 140, 140)).toBe(0);
  });
  it('never goes negative', () => {
    expect(remainingSeconds(9000, 6000, 140, 140)).toBe(0);
  });
});

describe('clampWpm', () => {
  it('keeps values in range', () => {
    expect(clampWpm(10)).toBe(60);
    expect(clampWpm(999)).toBe(300);
    expect(clampWpm(142.4)).toBe(142);
  });
});

describe('advanceOffset', () => {
  it('accumulates sub-pixel movement without rounding', () => {
    let offset = 0;
    for (let i = 0; i < 60; i++) offset = advanceOffset(offset, 30, 1000 / 60, 1000);
    expect(offset).toBeCloseTo(30, 6);
  });
  it('clamps at both ends', () => {
    expect(advanceOffset(99, 100, 1000, 100)).toBe(100);
    expect(advanceOffset(1, -100, 1000, 100)).toBe(0);
  });
});

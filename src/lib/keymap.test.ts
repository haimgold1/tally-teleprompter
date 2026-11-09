import { describe, expect, it } from 'vitest';
import { actionForKey } from './keymap';

describe('actionForKey', () => {
  it.each([' ', 'Enter', 'PageDown', 'ArrowRight', 'MediaPlayPause'])('%s toggles text', (key) => {
    expect(actionForKey({ key })).toBe('toggle-text');
  });
  it.each(['PageUp', 'ArrowLeft'])('%s jumps back', (key) => {
    expect(actionForKey({ key })).toBe('jump-back');
  });
  it('arrows change speed', () => {
    expect(actionForKey({ key: 'ArrowUp' })).toBe('speed-up');
    expect(actionForKey({ key: 'ArrowDown' })).toBe('speed-down');
  });
  it('R toggles recording, also on a Hebrew layout', () => {
    expect(actionForKey({ key: 'r' })).toBe('toggle-record');
    expect(actionForKey({ key: 'R' })).toBe('toggle-record');
    expect(actionForKey({ key: 'ר', code: 'KeyR' })).toBe('toggle-record');
  });
  it('ignores browser shortcuts and other keys', () => {
    expect(actionForKey({ key: 'r', metaKey: true })).toBeNull();
    expect(actionForKey({ key: 'r', ctrlKey: true, code: 'KeyR' })).toBeNull();
    expect(actionForKey({ key: 'x' })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { classifyCameraError, errorCopy, isQuotaError } from './errors';

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'permission'],
    ['NotReadableError', 'in-use'],
    ['NotFoundError', 'no-device'],
    ['WhateverError', 'unknown'],
  ])('%s → %s', (name, kind) => {
    expect(classifyCameraError({ name })).toBe(kind);
  });
  it('survives non-errors', () => {
    expect(classifyCameraError(null)).toBe('unknown');
  });
});

describe('isQuotaError', () => {
  it('detects the standard error and iOS wording', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ name: 'UnknownError', message: 'Quota exceeded' })).toBe(true);
    expect(isQuotaError({ name: 'AbortError', message: 'nope' })).toBe(false);
  });
});

describe('errorCopy', () => {
  it('gives platform-specific permission steps', () => {
    expect(errorCopy('permission', true).steps?.join(' ')).toContain('Safari');
    expect(errorCopy('permission', false).steps?.join(' ')).toContain('Chrome');
  });
});

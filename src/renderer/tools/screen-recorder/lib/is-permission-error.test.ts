import { describe, expect, it } from 'vitest';
import { isPermissionError } from './is-permission-error';

describe('isPermissionError', () => {
  it('matches messages mentioning permission, case-insensitively', () => {
    expect(isPermissionError('Screen Recording permission is required.')).toBe(true);
    expect(isPermissionError('PERMISSION denied by the OS')).toBe(true);
  });

  it('does not match unrelated failure messages', () => {
    expect(isPermissionError('Failed to start recording.')).toBe(false);
    expect(isPermissionError('')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { formatAverage, formatCountdown, formatDuration, formatPercent, initials } from './format';

describe('format', () => {
  it('formats countdowns, rounding up partial seconds and clamping at zero', () => {
    expect(formatCountdown(90_000)).toBe('1:30');
    expect(formatCountdown(4_200)).toBe('0:05');
    expect(formatCountdown(-500)).toBe('0:00');
  });

  it('formats averages and percentages', () => {
    expect(formatAverage(5)).toBe('5');
    expect(formatAverage(6.5)).toBe('6.5');
    expect(formatAverage(6.67)).toBe('6.7');
    expect(formatAverage(null)).toBe('—');
    expect(formatPercent(0.666)).toBe('67%');
  });

  it('formats timer presets', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(90)).toBe('1:30');
  });

  it('derives avatar initials', () => {
    expect(initials('Lalit Kumar Rajak')).toBe('LR');
    expect(initials('ana')).toBe('AN');
    expect(initials('  ')).toBe('?');
  });
});

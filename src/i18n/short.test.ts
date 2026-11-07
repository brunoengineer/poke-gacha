import { describe, expect, it } from 'vitest';
import { shortNumber } from './short';

describe('short numbers', () => {
  const en = (value: number) => shortNumber(value, 'en-US');

  it('stays exact below 1,000', () => {
    expect([0, 7, 248, 999].map(en)).toEqual(['0', '7', '248', '999']);
  });

  it('shortens to k, m, b and t, with one decimal only while it is a single digit', () => {
    expect([1000, 1300, 9999, 30000, 240500].map(en)).toEqual(['1k', '1.3k', '9.9k', '30k', '240k']);
    expect([2e6, 2.45e6, 300e6, 4e9, 999e9, 1.4e12].map(en)).toEqual(['2m', '2.4m', '300m', '4b', '999b', '1.4t']);
  });

  it('rounds down, so a number never shows more than it is', () => {
    expect([1299, 999999, 999999999].map(en)).toEqual(['1.2k', '999k', '999m']);
  });

  it('follows the language: a decimal comma in Portuguese', () => {
    expect(shortNumber(1300, 'pt-BR')).toBe('1,3k');
    expect(shortNumber(248, 'pt-BR')).toBe('248');
  });

  it('keeps the sign and handles infinity', () => {
    expect(en(-1500)).toBe('-1.5k');
    expect(en(Infinity)).toBe('∞');
  });
});

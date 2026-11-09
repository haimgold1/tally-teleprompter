import { describe, expect, it } from 'vitest';
import { countWords, detectDir, parseScript } from './text';

describe('countWords', () => {
  it('counts Hebrew words', () => {
    expect(countWords('שלום לכולם וברוכים הבאים')).toBe(4);
  });
  it('counts English and mixed text', () => {
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('היום נדבר על React ועל TypeScript')).toBe(6);
  });
  it('excludes [stage directions]', () => {
    expect(countWords('[נשימה] שלום [חיוך] לכולם')).toBe(2);
    expect(countWords('[breath]')).toBe(0);
    expect(countWords('[a long direction with many words] hello')).toBe(1);
  });
  it('counts an unclosed bracket as spoken text', () => {
    expect(countWords('[שלום לכולם')).toBe(2);
  });
  it('does not join brackets across lines', () => {
    expect(countWords('[שלום\nלכולם]')).toBe(2);
  });
  it('splits on Hebrew maqaf', () => {
    expect(countWords('בית־ספר גדול')).toBe(3);
  });
  it('keeps geresh and gershayim inside a word', () => {
    expect(countWords('ג׳ינס צה"ל')).toBe(2);
  });
  it('ignores punctuation and dashes standing alone', () => {
    expect(countWords('שלום — עולם ... !')).toBe(2);
  });
  it('counts numbers', () => {
    expect(countWords('יש 3 דברים')).toBe(3);
  });
  it('counts words with niqqud as one', () => {
    expect(countWords('שָׁלוֹם עוֹלָם')).toBe(2);
  });
  it('handles empty and whitespace', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  \n\t ')).toBe(0);
  });
});

describe('detectDir', () => {
  it('detects Hebrew and English', () => {
    expect(detectDir('שלום עולם')).toBe('rtl');
    expect(detectDir('Hello world')).toBe('ltr');
  });
  it('uses the majority of letters, not the first one', () => {
    expect(detectDir('OK אז היום אנחנו מדברים על זה')).toBe('rtl');
    expect(detectDir('שלום, this is mostly English text')).toBe('ltr');
  });
  it('ignores stage directions', () => {
    expect(detectDir('[breath] [smile] שלום')).toBe('rtl');
    expect(detectDir('[נשימה עמוקה מאוד מאוד] Hello')).toBe('ltr');
  });
  it('falls back to the direction text, then to left-to-right', () => {
    expect(detectDir('[smile]')).toBe('ltr');
    expect(detectDir('123 ...')).toBe('ltr');
  });
});

describe('parseScript', () => {
  it('gives each line its own direction', () => {
    const result = parseScript('שורה בעברית\nAn English line');
    expect(result.map((p) => p.dir)).toEqual(['rtl', 'ltr']);
  });
  it('splits text and directions in order', () => {
    expect(parseScript('שלום [חיוך] עולם')[0].segments).toEqual([
      { kind: 'text', text: 'שלום ' },
      { kind: 'direction', text: 'חיוך' },
      { kind: 'text', text: ' עולם' },
    ]);
  });
  it('drops blank lines and empty brackets', () => {
    expect(parseScript('א\n\n\r\n[ ]\nב')).toHaveLength(2);
  });
});

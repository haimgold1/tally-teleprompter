export type TextDir = 'rtl' | 'ltr';

export interface Segment {
  kind: 'text' | 'direction';
  text: string;
}

export interface Paragraph {
  dir: TextDir;
  segments: Segment[];
}

const DIRECTION = /\[[^\]\n]*\]/g;
const RTL_LETTER = /[֐-׿יִ-ﭏ؀-ۿݐ-ݿ]/g;
const LTR_LETTER = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/g;
/** Maqaf and en/em dashes separate spoken words; an ASCII hyphen stays inside a word. */
const WORD_BREAK = /[\s־–—]+/;
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

export function stripDirections(source: string): string {
  return source.replace(DIRECTION, ' ');
}

/** Spoken words only: [stage directions] and bare punctuation do not count. */
export function countWords(source: string): number {
  return stripDirections(source)
    .split(WORD_BREAK)
    .filter((token) => HAS_WORD_CHAR.test(token)).length;
}

/** Direction of the majority of letters, ignoring [stage directions]; left-to-right when undecided. */
export function detectDir(source: string): TextDir {
  const spoken = stripDirections(source);
  const sample = /\p{L}/u.test(spoken) ? spoken : source;
  const rtl = sample.match(RTL_LETTER)?.length ?? 0;
  const ltr = sample.match(LTR_LETTER)?.length ?? 0;
  return rtl > ltr ? 'rtl' : 'ltr';
}

function parseSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of line.matchAll(DIRECTION)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: 'text', text: line.slice(cursor, index) });
    const inner = match[0].slice(1, -1).trim();
    if (inner) segments.push({ kind: 'direction', text: inner });
    cursor = index + match[0].length;
  }
  if (cursor < line.length) segments.push({ kind: 'text', text: line.slice(cursor) });
  return segments;
}

/** Each non-empty line is one paragraph with its own detected direction. */
export function parseScript(source: string): Paragraph[] {
  return source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ dir: detectDir(line), segments: parseSegments(line) }))
    .filter((paragraph) => paragraph.segments.length > 0);
}

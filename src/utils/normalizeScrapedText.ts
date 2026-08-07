const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
};

const NON_BREAKING_HYPHEN = '‑';
const ZERO_WIDTH_SPACE = '​';

// Scraped descriptions often carry raw HTML numeric character references
// (e.g. "H&#xF6;ren" for "Hören") instead of the actual characters — some
// source sites serve their text already entity-encoded rather than as plain
// UTF-8. Decodes both hex (&#xF6;) and decimal (&#246;) numeric entities plus
// the common named ones, then normalizes two special characters that decode
// correctly but still look wrong in body text: the non-breaking hyphen
// (U+2011, used in "Pommes-Generation") reads as a plain "-" to a human, and
// a zero-width space (U+200B, often a leftover paragraph-break marker) reads
// as a normal word break — so both get converted to their plain-text
// equivalent instead of staying invisible/non-standard.
export function normalizeScrapedText(text: string): string {
  const decoded = text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const codePoint = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

  return decoded
    .split(NON_BREAKING_HYPHEN)
    .join('-')
    .split(ZERO_WIDTH_SPACE)
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

import type { NutritionFacts } from '../types/nutrition';

// Extracts a label's number, e.g. "davon Zucker: 12,5 g" -> 12.5, and returns
// the text with that match removed so a later, more general label (e.g.
// "Zucker") doesn't re-match a number that already belongs to a narrower one
// (e.g. "davon Zucker"). Order of extraction matters — call the more
// specific labels first (see parseNutritionText below).
function extractByLabel(text: string, labelPattern: string): { value: number | null; text: string } {
  const regex = new RegExp(`(?:${labelPattern})\\s*[:\\-]?\\s*([\\d]+(?:[.,]\\d+)?)`, 'i');
  const match = regex.exec(text);
  if (!match || match.index == null) {
    return { value: null, text };
  }
  const value = parseFloat(match[1].replace(',', '.'));
  const cleaned = text.slice(0, match.index) + text.slice(match.index + match[0].length);
  return { value: Number.isFinite(value) ? value : null, text: cleaned };
}

// Energy is anchored on the unit ("550 kcal") rather than the "Energie"
// label, since one line often states both kJ and kcal ("2300 kJ / 550
// kcal") and a label-anchored search would only ever find the first number.
function extractByUnit(text: string, unitPattern: string): number | null {
  const regex = new RegExp(`([\\d]+(?:[.,]\\d+)?)\\s*${unitPattern}\\b`, 'i');
  const match = regex.exec(text);
  if (!match) {
    return null;
  }
  const value = parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export interface ParseNutritionTextResult {
  nutrition: NutritionFacts;
  matchedCount: number;
}

// Best-effort extraction of a standard EU nutrition table from free-form
// text (pasted from a label/website, or plain page text as a scraper
// fallback). Matches label + number pairs; doesn't understand full
// sentences, so always treat the result as a starting point to verify, not
// a guaranteed-correct parse.
export function parseNutritionText(rawText: string): ParseNutritionTextResult {
  let working = rawText;

  const saturatedFat = extractByLabel(
    working,
    "(?:davon\\s+)?ges[äa]ttigte[n]?\\s+fetts[äa]uren|saturated\\s+fat",
  );
  working = saturatedFat.text;

  const sugars = extractByLabel(working, '(?:davon\\s+)?zucker|sugars?');
  working = sugars.text;

  // Negative lookahead avoids "fett" inside a stray "Fettsäuren" remnant
  // matching as plain fat if the saturatedFat pattern above didn't catch it
  // (e.g. unexpected phrasing) — a real "Fett" label is never immediately
  // followed by "säuren"/"saeuren".
  const fat = extractByLabel(working, 'fett(?!s[äa]uren)|fat');
  working = fat.text;

  const carbohydrates = extractByLabel(working, 'kohlenhydrate|carbohydrates?');
  working = carbohydrates.text;

  const fiber = extractByLabel(working, 'ballaststoffe|fiber|fibre');
  working = fiber.text;

  const protein = extractByLabel(working, 'eiwei[ßs]s?|protein');
  working = protein.text;

  const salt = extractByLabel(working, 'salz|salt');
  working = salt.text;

  const energyKcal = extractByUnit(rawText, 'kcal');
  const energyKj = extractByUnit(rawText, 'kj');

  const nutrition: NutritionFacts = {
    energyKcal,
    energyKj,
    fat: fat.value,
    saturatedFat: saturatedFat.value,
    carbohydrates: carbohydrates.value,
    sugars: sugars.value,
    fiber: fiber.value,
    protein: protein.value,
    salt: salt.value,
  };

  const matchedCount = Object.values(nutrition).filter((value) => value != null).length;

  return { nutrition, matchedCount };
}

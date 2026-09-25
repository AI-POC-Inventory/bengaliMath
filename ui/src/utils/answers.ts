// Answer handling for the practice screen.
//
// The curriculum API returns every answer as a STRING (questions.answer is a
// TEXT column): "2" for a multiple-choice question means "the third option",
// and short answers are free text such as "25%" or "২০%". The practice screen
// works with numeric option indexes, and students type short answers however
// they like, so both sides are normalised here rather than compared raw.

const BENGALI_TO_LATIN: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

export function toLatinDigits(text: string): string {
  return text.replace(/[০-৯]/g, d => BENGALI_TO_LATIN[d]);
}

/** A multiple-choice answer as the option index the screen compares against.
 *  Anything that is not a plain non-negative integer (bad data in the bank,
 *  e.g. "" or "৭E") is returned untouched so it simply matches no option
 *  instead of silently becoming option 0. */
export function normalizeMcqAnswer(raw: number | string): number | string {
  if (typeof raw === 'number') return raw;
  const digits = toLatinDigits(raw.trim());
  return /^\d+$/.test(digits) ? Number(digits) : raw;
}

/** Canonical form for comparing short answers: Latin digits, no spaces, no
 *  thousands separators, no % sign, case-insensitive. */
function canonical(text: string): string {
  return toLatinDigits(text.normalize('NFC'))
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/%$/, '');
}

const NUMERIC = /^-?(\d+\.?\d*|\.\d+)$/;

/** Does the student's typed answer match the stored one? "25", "২৫%", " 25 % "
 *  all match "25%"; "0.50" matches "0.5". Non-numeric answers are compared as
 *  canonical text. */
export function shortAnswersMatch(student: string, correct: string): boolean {
  const a = canonical(student);
  const b = canonical(correct);
  if (a === '' || b === '') return false;
  if (a === b) return true;
  return NUMERIC.test(a) && NUMERIC.test(b) && Number(a) === Number(b);
}

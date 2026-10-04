export const kUnitsPerGram = 40; // 1g = 4 habba = 40 juz
export const kUnitsPerHabba = 10;
export const kCurrency = 'ج.س';

// Convert grams, habba, juz into total units
export function weightToUnits(grams: number = 0, habba: number = 0, juz: number = 0): number {
  return (grams * kUnitsPerGram) + (habba * kUnitsPerHabba) + juz;
}

// Convert total units into readable string: e.g. "12.5 ج" or "10 ج و 2 ح و 4 ز"
export function unitsToWeight(units: number): string {
  if (units <= 0) return '0.00 ج';
  const grams = Math.floor(units / kUnitsPerGram);
  const remaining = units % kUnitsPerGram;
  const habba = Math.floor(remaining / kUnitsPerHabba);
  const juz = remaining % kUnitsPerHabba;

  const parts: string[] = [];
  if (grams > 0) parts.push(`${grams} ج`);
  if (habba > 0) parts.push(`${habba} ح`);
  if (juz > 0) parts.push(`${juz} ز`);

  if (parts.length === 0) return '0 ج';
  return parts.join(' و ');
}

// Format units as decimal grams: e.g. 10.25
export function unitsToGramsDecimal(units: number): number {
  return units / kUnitsPerGram;
}

// Format numbers with commas
export function fmtNum(n: number): string {
  if (isNaN(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

// Format money
export function fmtMoney(n: number): string {
  return `${fmtNum(n)} ${kCurrency}`;
}

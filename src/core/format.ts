// The Sudanese display uses a three-part quantity: grams.habba.juz.
// Keep the entered habba value visible (9 habba stays 0.9.0) instead of
// converting it into whole grams. One gram is represented by 100 sub-units.
export const kUnitsPerGram = 100;
export const kUnitsPerHabba = 10;
export const kCurrency = 'ج.س';

// Convert grams, habba, juz into total units
export function weightToUnits(grams: number = 0, habba: number = 0, juz: number = 0): number {
  return (grams * kUnitsPerGram) + (habba * kUnitsPerHabba) + juz;
}

// Convert total units into standard Sudanese notation: "0.9.0" or "3.9.0"
export function unitsToGhJ(units: number): string {
  if (!units || units <= 0) return '0.0.0';
  const grams = Math.floor(units / kUnitsPerGram);
  const remaining = units % kUnitsPerGram;
  const habba = Math.floor(remaining / kUnitsPerHabba);
  const juz = Math.round(remaining % kUnitsPerHabba);
  return `${grams}.${habba}.${juz}`;
}

// Convert total units into readable Arabic string: e.g. "12 ج و 2 ح و 4 ز"
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
  if (isNaN(n) || n === undefined || n === null) return '0';
  return Math.round(n).toLocaleString('en-US');
}

// Format money
export function fmtMoney(n: number): string {
  return `${fmtNum(n)} ${kCurrency}`;
}

// Format Date as D/M/YYYY
export function formatInvoiceDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch (_) {
    return dateStr;
  }
}

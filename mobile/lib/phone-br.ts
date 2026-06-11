/** Normaliza para o mesmo formato esperado pelo backend (55 + DDD + número). */
export function normalizeBrPhoneDigits(input: string): string | null {
  const d = input.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) {
    return d;
  }
  let x = d;
  if (x.length === 11 && x.startsWith('0')) {
    x = x.slice(1);
  }
  if (x.length === 10 || x.length === 11) {
    return `55${x}`;
  }
  return null;
}

/** Ex.: 5563991249775 → (63) 99124-9775 */
export function formatBrMobileDisplayFromDigits(full: string): string {
  const d = full.replace(/\D/g, '');
  if (d.length < 12 || !d.startsWith('55')) {
    return full;
  }
  const rest = d.slice(2);
  if (rest.length === 11) {
    const ddd = rest.slice(0, 2);
    const nine = rest.slice(2);
    return `(${ddd}) ${nine.slice(0, 5)}-${nine.slice(5)}`;
  }
  if (rest.length === 10) {
    const ddd = rest.slice(0, 2);
    const num = rest.slice(2);
    return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  return full;
}

const DAYS = ['E Diel', 'E Hënë', 'E Martë', 'E Mërkurë', 'E Enjte', 'E Premte', 'E Shtunë'];

function toLocalDate(date: Date | string): Date {
  if (typeof date === 'string') {
    // Date-only strings like "2026-05-12" are UTC midnight — shift to local
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(date);
  }
  return date;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDateAL(date: Date | string, showWeekday = false): string {
  const d = toLocalDate(date);
  const formatted = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return showWeekday ? `${DAYS[d.getDay()]}, ${formatted}` : formatted;
}

export function formatDateTimeAL(date: Date | string): string {
  const d = toLocalDate(date);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

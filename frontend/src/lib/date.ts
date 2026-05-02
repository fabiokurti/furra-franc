const DAYS = ['E Diel', 'E Hënë', 'E Martë', 'E Mërkurë', 'E Enjte', 'E Premte', 'E Shtunë'];
const MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];

export function formatDateAL(date: Date | string, showWeekday = false): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return showWeekday ? `${DAYS[d.getDay()]}, ${base}` : base;
}

export const zone = 'America/Chicago';
export function chicagoDay(value: string | number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function observedTime(value: string | number, date = false) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, ...(date ? { month: 'short', day: 'numeric' } as const : {}), hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
export function age(value: string | null, now: string) {
  if (!value) return 'Never';
  const minutes = Math.max(0, Math.floor((Date.parse(now)-Date.parse(value))/60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes/60)}h ${minutes%60}m ago`;
  return `${Math.floor(minutes/1440)} days ago`;
}
// Literal wall-clock display: never parse an offset-free source timestamp as an instant.
export function sourceTime(raw: string | null) { return raw ? raw.replace('T', ' · ').replace(/\.\d+$/, '') : 'Unavailable'; }

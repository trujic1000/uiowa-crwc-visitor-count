export function collectionStatus(lastSuccess: string | null, now: string) {
  if (!lastSuccess) return 'No successful collection';
  const age = Math.max(0, Date.parse(now) - Date.parse(lastSuccess)) / 60_000;
  return age <= 15 ? 'Up to date' : age <= 30 ? 'Delayed' : 'Collection overdue';
}


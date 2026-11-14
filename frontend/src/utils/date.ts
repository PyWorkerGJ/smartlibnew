export function parseDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  // If format is 'YYYY-MM-DD HH:mm:ss', replace space with 'T' so all browsers parse as local time
  const normalized = dateStr.includes(' ') && !dateStr.includes('T') ? dateStr.replace(' ', 'T') : dateStr;
  return new Date(normalized);
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return parseDate(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return parseDate(dateStr).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: true });
}

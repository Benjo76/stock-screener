/**
 * General purpose formatting helpers for numbers, currencies, percentages and dates.
 */

export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'EUR',
  locale: string = 'de-DE'
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  locale: string = 'de-DE',
  decimals: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${value > 0 ? '+' : ''}${formatted}%`;
}

export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2,
  locale: string = 'de-DE'
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(
  dateValue: string | Date | null | undefined,
  locale: string = 'de-DE'
): string {
  if (!dateValue) return '—';
  const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale);
}

export function formatTime(
  dateValue: string | Date | null | undefined,
  locale: string = 'de-DE'
): string {
  if (!dateValue) return '—';
  const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(locale);
}

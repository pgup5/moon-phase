export const MIN_DATE = '1900-01-01T00:00';
export const MAX_DATE = '2100-12-31T23:59';
export function supportedDate(date) {
  return date instanceof Date && Number.isFinite(+date) &&
    date.getFullYear() >= 1900 && date.getFullYear() <= 2100 &&
    date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2100;
}

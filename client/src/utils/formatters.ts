/**
 * Format a number as a currency string
 * @param value - Number to format
 * @param currency - Currency symbol
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number, currency = '$'): string => {
  if (value === undefined || value === null) return `${currency}0.00`;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Format a number as a percentage
 * @param value - Number to format
 * @returns Formatted percentage string
 */
export const formatPercent = (value: number): string => {
  if (value === undefined || value === null) return '0%';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
};

/**
 * Format a date string to a readable format
 * @param dateString - Date string to format
 * @returns Formatted date string 
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};
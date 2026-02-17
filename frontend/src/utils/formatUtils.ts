/**
 * Utility functions for consistent formatting across the application
 */

/**
 * Formats a number as currency using Italian locale
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "€ 5.000")
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Formats a date using Italian locale
 * @param dateString - The date string to format
 * @returns Formatted date string (e.g., "15/03/2025")
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  
  try {
    let date: Date;
    
    // Check if the date is already in DD/MM/YYYY format
    if (dateString.includes('/') && dateString.length === 10) {
      const [day, month, year] = dateString.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      date = new Date(dateString);
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    return new Intl.DateTimeFormat('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (error) {
    console.warn('Invalid date format:', dateString, error);
    return '-';
  }
};

/**
 * Formats a number with Italian locale (without currency symbol)
 * @param amount - The amount to format
 * @returns Formatted number string (e.g., "5.000")
 */
export const formatNumber = (amount: number): string => {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

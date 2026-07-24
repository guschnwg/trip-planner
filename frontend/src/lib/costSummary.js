import { getEventsForTrip } from '../stores/events.js';

// Aggregate event prices per currency. `null`/missing prices are treated as
// "free" and counted separately. Returns:
//   - buckets: array of { currency, total, paid, pending } (sorted by code)
//   - freeCount: number of events without a price
export const summarizeCosts = (tripId) => {
  const events = getEventsForTrip(tripId);
  return summarizeItems(events);
};

export const summarizeItems = (items) => {
  const buckets = new Map();
  let freeCount = 0;

  const ensure = (currency) => {
    if (!buckets.has(currency)) {
      buckets.set(currency, { total: 0, paid: 0, pending: 0 });
    }
    return buckets.get(currency);
  };

  for (const event of items || []) {
    if (event.price == null) {
      freeCount += 1;
      continue;
    }
    const currency = event.currency || 'USD';
    const bucket = ensure(currency);
    bucket.total += event.price;
    if (event.isPaid) {
      bucket.paid += event.price;
    } else {
      bucket.pending += event.price;
    }
  }

  return {
    buckets: [...buckets.entries()]
      .map(([currency, value]) => ({ currency, ...value }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    freeCount,
  };
};

const formattersFor = (locale) => {
  const cache = new Map();
  return (currency) => {
    const key = currency || 'USD';
    const cached = cache.get(key);
    if (cached) return cached;
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: key,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: key === 'JPY' ? 0 : 2,
    });
    cache.set(key, formatter);
    return formatter;
  };
};

const formatterCache = new Map();
const getFormatterSet = (locale) => {
  let set = formatterCache.get(locale);
  if (!set) {
    set = formattersFor(locale);
    formatterCache.set(locale, set);
  }
  return set;
};

export const formatAmount = (amount, currency, locale) => {
  try {
    const format = getFormatterSet(locale)(currency);
    return format.format(amount);
  } catch {
    return `${amount.toFixed(currency === 'JPY' ? 0 : 2)} ${currency}`;
  }
};

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
  { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'COP', symbol: 'Col$', name: 'Colombian Peso' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso' },
];
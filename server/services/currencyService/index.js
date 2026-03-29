import { EXCHANGE_RATE_CACHE_TTL_MS } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';

// In-memory cache: { [baseCurrency]: { rates: {}, fetchedAt: timestamp } }
const rateCache = new Map();

/**
 * Fetches exchange rates for a base currency, with 1-hour in-memory caching
 */
async function getRates(baseCurrency) {
  const cached = rateCache.get(baseCurrency);
  if (cached && Date.now() - cached.fetchedAt < EXCHANGE_RATE_CACHE_TTL_MS) {
    return cached.rates;
  }
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const url = apiKey && apiKey !== 'your_key_from_exchangerate-api.com'
    ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
    : `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ApiError(
      503,
      'Currency exchange service is unavailable. Please try again later.'
    );
  }

  if (!response.ok) {
    throw new ApiError(
      503,
      `Failed to fetch exchange rates for ${baseCurrency}. Status: ${response.status}`
    );
  }

  const data = await response.json();
  const rates = data.conversion_rates || data.rates;
  rateCache.set(baseCurrency, { rates, fetchedAt: Date.now() });
  return rates;
}

/**
 * Converts amount from one currency to another using live exchange rates
 * Returns { convertedAmount, rate }
 */
async function convertToCompanyCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, rate: 1 };
  }

  const rates = await getRates(fromCurrency);
  const rate = rates[toCurrency];

  if (!rate) {
    throw new ApiError(400, `Unsupported currency conversion: ${fromCurrency} → ${toCurrency}`);
  }

  const convertedAmount = parseFloat((amount * rate).toFixed(2));
  return { convertedAmount, rate };
}

/**
 * Get just the exchange rate between two currencies
 */
async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;
  const rates = await getRates(fromCurrency);
  const rate = rates[toCurrency];
  if (!rate) throw new ApiError(400, `Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
  return rate;
}

export default { convertToCompanyCurrency, getExchangeRate, getRates };

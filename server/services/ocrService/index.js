import path from 'path';
import { createWorker } from 'tesseract.js';

/**
 * Real OCR service powered by Tesseract.js
 * No API key required — runs fully offline in Node.js
 */

// ─── Text Parsers ─────────────────────────────────────────────

/**
 * Extract the largest amount from OCR text
 * Looks for patterns like: $10.50, 10.50, Rs 100, USD 200, 200.00
 */
function extractAmount(text) {
  // Remove common words that might look like amounts
  const cleaned = text.replace(/\b(Date|No|#)\b/gi, '');

  const patterns = [
    // currency symbol + number: $10.50, £100, ₹500
    /[₹$£€¥฿]\s*[\d,]+\.?\d*/g,
    // TOTAL / AMOUNT label followed by number
    /(?:TOTAL|AMOUNT|SUBTOTAL|NET|GRAND)\s*:?\s*[\d,]+\.?\d*/gi,
    // standalone decimal: 100.50 (but not dates like 2024.03)
    /\b\d{1,6}\.\d{2}\b/g,
    // whole numbers > 10
    /\b[1-9]\d{1,5}\b/g,
  ];

  const candidates = [];
  for (const pattern of patterns) {
    const matches = cleaned.match(pattern) || [];
    for (const m of matches) {
      const num = parseFloat(m.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0 && num < 1_000_000) {
        candidates.push(num);
      }
    }
  }

  if (candidates.length === 0) return null;
  // Return the largest credible amount (most likely the total)
  return Math.max(...candidates);
}

/**
 * Extract a date from OCR text
 * Handles: 2024-03-15, 15/03/2024, March 15 2024, 15 Mar 24
 */
function extractDate(text) {
  const patterns = [
    // ISO: 2024-03-15
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
    // DD/MM/YYYY or MM/DD/YYYY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
    // Month name: March 15, 2024 or 15 March 2024
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(\d{2,4})\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})[,\s]+(\d{2,4})\b/i,
  ];

  const monthMap = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      try {
        let year, month, day;

        if (/[a-zA-Z]/.test(m[0])) {
          // Month name patterns
          const parts = m[0].match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})/i) ||
                        m[0].match(/([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{2,4})/i);
          if (parts) {
            if (/\d/.test(parts[1])) {
              day = parseInt(parts[1]);
              month = monthMap[parts[2].toLowerCase().slice(0, 3)];
              year = parseInt(parts[3]);
            } else {
              month = monthMap[parts[1].toLowerCase().slice(0, 3)];
              day = parseInt(parts[2]);
              year = parseInt(parts[3]);
            }
          }
        } else {
          // Numeric patterns
          const nums = m[0].match(/\d+/g).map(Number);
          if (nums[0] > 31) { // YYYY-MM-DD
            [year, month, day] = nums;
          } else if (nums[2] > 31) { // DD/MM/YYYY
            [day, month, year] = nums;
          } else {
            [day, month, year] = nums;
          }
        }

        if (year && year < 100) year += 2000;
        if (year && month && day && month <= 12 && day <= 31) {
          const d = new Date(year, month - 1, day);
          if (!isNaN(d.getTime()) && d <= new Date()) {
            return d.toISOString().split('T')[0];
          }
        }
      } catch {
        // continue
      }
    }
  }

  return new Date().toISOString().split('T')[0]; // fallback to today
}

/**
 * Extract merchant/business name from OCR text
 * Takes the first meaningful non-generic capitalized line
 */
function extractMerchant(text) {
  const ignore = /^(receipt|invoice|bill|tax|date|total|amount|subtotal|phone|tel|email|www|http|address|thank|visit|customer|no\.|order|item|qty|unit|price|vat|gst|ref|payment|cash|card|change|balance|due)/i;

  const lines = text.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 60)
    .filter((l) => !ignore.test(l))
    .filter((l) => /[A-Za-z]/.test(l));

  // Prefer lines with Title Case or ALL CAPS (merchant names)
  const titleCaseLines = lines.filter((l) => /^[A-Z][A-Za-z\s&.''-]+$/.test(l));
  if (titleCaseLines.length > 0) return titleCaseLines[0];

  return lines[0] || 'Business Expense';
}

/**
 * Map merchant name to expense category
 */
function inferCategory(merchantName, text) {
  const combined = `${merchantName} ${text}`.toLowerCase();

  if (/hotel|inn|resort|lodge|airbnb|marriott|hilton|hyatt|hostel|accommodation/.test(combined))
    return 'Accommodation';
  if (/airline|flight|airways|uber|lyft|taxi|bus|train|railway|metro|travel|airport/.test(combined))
    return 'Travel';
  if (/restaurant|café|cafe|dinner|lunch|food|pizza|burger|mcdonald|starbucks|kfc|meal|bar/.test(combined))
    return 'Food';
  if (/amazon|apple|computer|laptop|phone|equipment|office|depot|dell|hp|software/.test(combined))
    return 'Equipment';

  return 'Other';
}

// ─── Main Export ──────────────────────────────────────────────

async function extractReceiptData(filePath) {
  const ext = filePath ? path.extname(filePath).toLowerCase() : '';
  const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];

  if (!supportedFormats.includes(ext) && ext !== '') {
    // PDF or unsupported — return empty (PDF needs separate handling)
    return {
      amount: null,
      date: new Date().toISOString().split('T')[0],
      merchantName: null,
      description: 'Business Expense',
      category: 'Other',
      confidence: 0,
      rawText: '',
    };
  }

  let rawText = '';
  let confidence = 0;

  try {
    const worker = await createWorker('eng', 1, {
      // Silence Tesseract logs in production
      logger: () => {},
    });

    const { data } = await worker.recognize(filePath);
    rawText = data.text || '';
    confidence = parseFloat((data.confidence / 100).toFixed(2));
    await worker.terminate();
  } catch (err) {
    console.error('Tesseract OCR error:', err.message);
    // Return graceful fallback
    return {
      amount: null,
      date: new Date().toISOString().split('T')[0],
      merchantName: null,
      description: 'Business Expense',
      category: 'Other',
      confidence: 0,
      rawText: '',
    };
  }

  const amount = extractAmount(rawText);
  const date = extractDate(rawText);
  const merchantName = extractMerchant(rawText);
  const category = inferCategory(merchantName, rawText);

  return {
    amount,
    date,
    merchantName,
    description: merchantName ? `${merchantName} - Business expense` : 'Business Expense',
    category,
    confidence,
    rawText: rawText.slice(0, 1000), // store first 1000 chars for debugging
  };
}

export default { extractReceiptData };

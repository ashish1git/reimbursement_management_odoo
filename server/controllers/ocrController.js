import multer from 'multer';
import path from 'path';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import ocrService from '../services/ocrService/index.js';

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Allowed: JPEG, PNG, WEBP, PDF'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// POST /api/ocr/parse-receipt
export const parseReceipt = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');

  const extracted = await ocrService.extractReceiptData(req.file.path);

  res.json(
    new ApiResponse(
      200,
      {
        ...extracted,
        receiptUrl: `/uploads/receipts/${req.file.filename}`,
        fileName: req.file.originalname,
      },
      'Receipt parsed successfully'
    )
  );
});

// GET /api/ocr/rate-preview — Real-time currency conversion preview
export const getRatePreview = asyncHandler(async (req, res) => {
  const { amount, from, to } = req.query;
  if (!amount || !from || !to) {
    throw new ApiError(400, 'amount, from, and to are required');
  }

  const currencyService = (await import('../services/currencyService/index.js')).default;
  const { convertedAmount, rate } = await currencyService.convertToCompanyCurrency(
    parseFloat(amount),
    from.toUpperCase(),
    to.toUpperCase()
  );

  res.json(new ApiResponse(200, { convertedAmount, rate, from, to }, 'Rate preview'));
});

// Format currency with proper symbol
export const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount || 0);
};

// Format date to readable format
export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format date and time
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Time ago helper
export const timeAgo = (date) => {
  if (!date) return 'N/A';
  
  const now = new Date();
  const past = new Date(date);
  const seconds = Math.floor((now - past) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  
  return formatDate(date);
};

// Expense category icons
export const CATEGORY_ICONS = {
  'Travel': '✈️',
  'Food': '🍽️',
  'Accommodation': '🏨',
  'Transportation': '🚗',
  'Entertainment': '🎭',
  'Office Supplies': '📎',
  'Software': '💻',
  'Training': '📚',
  'Equipment': '🛠️',
  'Other': '📦',
  'Meals': '🍽️',
  'Hotel': '🏨',
  'Flight': '✈️',
  'Cab': '🚕',
  'Uber': '🚗',
  'Books': '📖',
  'Meeting': '👥',
  'Conference': '🎤',
};

// Available currencies
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'SGD', 'HKD'];

// Expense categories
export const CATEGORIES = [
  'Travel',
  'Food',
  'Accommodation',
  'Transportation',
  'Entertainment',
  'Office Supplies',
  'Software',
  'Training',
  'Equipment',
  'Other',
];

// Paid by options
export const PAID_BY_OPTIONS = ['Employee', 'Company'];

// Expense status colors
export const STATUS_COLORS = {
  'Pending': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Approved': 'bg-green-50 text-green-700 border-green-200',
  'Rejected': 'bg-red-50 text-red-700 border-red-200',
  'Resubmitted': 'bg-blue-50 text-blue-700 border-blue-200',
  'Submitted': 'bg-slate-50 text-slate-700 border-slate-200',
};

// Status badge bgColor
export const STATUS_BG_COLORS = {
  'Pending': 'from-yellow-100 to-yellow-50',
  'Approved': 'from-green-100 to-green-50',
  'Rejected': 'from-red-100 to-red-50',
  'Resubmitted': 'from-blue-100 to-blue-50',
  'Submitted': 'from-slate-100 to-slate-50',
};

// Status icon
export const STATUS_ICONS = {
  'Pending': '⏳',
  'Approved': '✅',
  'Rejected': '❌',
  'Resubmitted': '🔄',
  'Submitted': '📤',
};

// Validate file size
export const validateFileSize = (file, maxSize = 5) => {
  const fileSizeInMB = file.size / 1024 / 1024;
  return fileSizeInMB <= maxSize;
};

// Validate file type
export const validateFileType = (file, allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']) => {
  return allowedTypes.includes(file.type);
};

// Generate random ID
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

// Calculate percentage
export const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(2));
};

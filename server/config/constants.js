export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  FINANCE: 'FINANCE',
  DIRECTOR: 'DIRECTOR',
  EMPLOYEE: 'EMPLOYEE',
};

export const EXPENSE_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FLAGGED: 'FLAGGED',
};

export const EXPENSE_CATEGORIES = ['Travel', 'Food', 'Accommodation', 'Equipment', 'Other'];

export const PAID_BY_OPTIONS = ['Employee', 'Company'];

export const APPROVAL_ACTIONS = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
};

export const RULE_TYPES = {
  NONE: 'NONE',
  PERCENTAGE: 'PERCENTAGE',
  SPECIFIC: 'SPECIFIC',
  HYBRID: 'HYBRID',
};

export const APPROVER_ROLES = ['MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'];

export const HIGH_AMOUNT_THRESHOLD = parseInt(process.env.HIGH_AMOUNT_THRESHOLD) || 10000;

export const EXCHANGE_RATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

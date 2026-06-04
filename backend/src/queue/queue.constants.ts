/** Queue names used throughout the application. */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Notification job types. */
export const NOTIFICATION_JOBS = {
  ORDER_PLACED: 'order.placed',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_APPROVED: 'payment.approved',
  PAYMENT_REJECTED: 'payment.rejected',
  PASSWORD_RESET: 'auth.password_reset',
} as const;

export type NotificationJobType = (typeof NOTIFICATION_JOBS)[keyof typeof NOTIFICATION_JOBS];

// ─── Job payload types ─────────────────────────────────────────────────────

export type OrderPlacedJobData = {
  orderId: string;
  userId: string | null;
  totalAmount: number;
};

export type OrderStatusChangedJobData = {
  orderId: string;
  userId: string | null;
  status: string;
};

export type PaymentJobData = {
  orderId: string;
  paymentId: string;
  userId: string | null;
  amount: number;
};

export type PasswordResetJobData = {
  userId: string;
  email: string;
  resetUrl: string;
};

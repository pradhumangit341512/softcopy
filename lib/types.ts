// ==================== ENUMS ====================

export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  USER = 'user',
}

export enum ClientStatus {
  NEW = 'New',
  INTERESTED = 'Interested',
  DEAL_DONE = 'DealDone',
  REJECTED = 'Rejected',
}

export enum InquiryType {
  BUY = 'Buy',
  SELL = 'Sell',
  RENT = 'Rent',
}

export enum RequirementType {
  ONE_BHK = '1BHK',
  TWO_BHK = '2BHK',
  THREE_BHK = '3BHK',
  STUDIO = 'Studio',
  PROPERTY = 'Property',
  LAND = 'Land',
  RENTAL = 'Rental',
  COMMERCIAL = 'Commercial',
}

export enum CommissionStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
}

export enum SubscriptionType {
  BASIC = 'Basic',
  PRO = 'Pro',
  ENTERPRISE = 'Enterprise',
}

export enum CompanyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// ==================== MODELS ====================

export interface Company {
  id: string;
  companyName: string;
  logo?: string;
  subscriptionType: SubscriptionType;
  subscriptionExpiry: Date;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: string;
  profilePhoto?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
}

export interface UserWithoutPassword extends Omit<User, 'password'> {}

export interface Client {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  companyName?: string;
  requirementType: RequirementType;
  inquiryType: InquiryType;
  budget?: number;
  preferredLocation?: string;
  address?: string;
  visitingDate?: Date;
  visitingTime?: string;
  followUpDate?: Date;
  status: ClientStatus;
  source?: string;
  notes?: string;
  companyId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: User;
  commissions?: Commission[];
}

export interface Commission {
  id: string;
  clientId: string;
  userId: string;
  companyId: string;
  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidStatus: CommissionStatus;
  paymentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  client?: Client;
  user?: User;
  company?: Company;
}

export interface OTP {
  id: string;
  phone: string;
  otp: string;
  companyId: string;
  expiresAt: Date;
  createdAt: Date;
  company?: Company;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  amount: number;
  paymentStatus: string;
  planType: SubscriptionType;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  validFrom: Date;
  validUpto: Date;
  createdAt: Date;
  updatedAt: Date;
  company?: Company;
}

// ==================== API REQUESTS ====================

export interface SignupRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  companyName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateClientRequest {
  clientName: string;
  phone: string;
  email?: string;
  companyName?: string;
  requirementType: RequirementType;
  inquiryType: InquiryType;
  budget?: number;
  preferredLocation?: string;
  address?: string;
  visitingDate?: Date;
  visitingTime?: string;
  followUpDate?: Date;
  status: ClientStatus;
  source?: string;
  notes?: string;
}

export interface UpdateClientRequest extends Partial<CreateClientRequest> {}

export interface CreateCommissionRequest {
  clientId: string;
  userId: string;
  dealAmount: number;
  commissionPercentage: number;
}

export interface UpdateCommissionRequest {
  paidStatus?: CommissionStatus;
}

export interface ResetPasswordRequest {
  phone: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  phone?: string;
  profilePhoto?: string;
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp?: Date;
}

export interface LoginResponse {
  user: UserWithoutPassword;
  token: string;
  company: Company;
}

export interface SignupResponse {
  user: UserWithoutPassword;
  token: string;
  company: Company;
}

export interface ClientResponse extends Client {}

export interface ClientsListResponse {
  clients: Client[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CommissionResponse extends Commission {}

export interface CommissionListResponse {
  commissions: Commission[];
  totals: {
    totalCommission: number;
    pendingCommission: number;
    paidCommission: number;
  };
}

export interface AnalyticsResponse {
  summary: {
    totalClients: number;
    todayVisits: number;
    closedDeals: number;
    totalCommission: number;
  };
  leadsByStatus: Array<{
    status: ClientStatus;
    _count: number;
  }>;
  monthlyData: Array<{
    month: string;
    leads: number;
    deals: number;
  }>;
}

export interface CommissionAnalyticsResponse {
  byStatus: Array<{
    status: CommissionStatus;
    _sum: { commissionAmount: number };
    _count: number;
  }>;
  topPerformers: Array<{
    userId: string;
    userName: string;
    totalCommission: number;
    deals: number;
  }>;
}

// ==================== AUTH TYPES ====================

export interface JWTPayload {
  userId: string;
  companyId: string;
  role: UserRole;
  email: string;
}

export interface AuthState {
  user: UserWithoutPassword | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// ==================== FILTER & PAGINATION ====================

export interface ClientFilters {
  search?: string;
  status?: ClientStatus;
  inquiryType?: InquiryType;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  userId?: string;
  location?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ==================== FORM TYPES ====================

export interface ClientFormData {
  clientName: string;
  phone: string;
  email?: string;
  companyName?: string;
  requirementType: RequirementType;
  inquiryType: InquiryType;
  budget?: number;
  preferredLocation?: string;
  address?: string;
  visitingDate?: Date | string;
  visitingTime?: string;
  followUpDate?: Date | string;
  status: ClientStatus;
  source?: string;
  notes?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  companyName: string;
}

export interface ForgotPasswordFormData {
  email: string;
  phone: string;
}

export interface ResetPasswordFormData {
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

// ==================== UI TYPES ====================

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface Modal {
  isOpen: boolean;
  title?: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface SearchResult {
  clients: Client[];
  query: string;
  timestamp: Date;
}

export interface ExportOptions {
  type: 'excel' | 'pdf';
  format: 'all' | 'filtered' | 'today';
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// ==================== DASHBOARD TYPES ====================

export interface DashboardStats {
  totalClients: number;
  todayVisits: number;
  closedDealsMonth: number;
  totalCommissionMonth: number;
  averageCommission: number;
  conversionRate: number;
}

export interface MonthlyData {
  month: string;
  leads: number;
  deals: number;
  revenue: number;
  commissions: number;
}

export interface LeadSource {
  source: string;
  count: number;
  percentage: number;
}

export interface TopPerformer {
  userId: string;
  userName: string;
  totalCommission: number;
  closedDeals: number;
  successRate: number;
}

// ==================== NOTIFICATION TYPES ====================

export interface Notification {
  id: string;
  userId: string;
  type: 'visit_reminder' | 'followup_reminder' | 'commission_paid' | 'client_created';
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface VisitReminder {
  clientId: string;
  clientName: string;
  visitingDate: Date;
  visitingTime: string;
  phone: string;
  location?: string;
}

// ==================== PAYMENT TYPES ====================

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  email: string;
  contact: string;
  created_at: number;
}

export interface SubscriptionPlan {
  type: SubscriptionType;
  name: string;
  price: number;
  currency: string;
  features: string[];
  maxUsers: number;
  durationDays: number;
}

// ==================== VALIDATION TYPES ====================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ==================== COMMON TYPES ====================

export interface PageProps {
  params?: Record<string, string>;
  searchParams?: Record<string, string | string[]>;
}

export interface NextApiResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export interface SuccessResponse<T = any> {
  status: number;
  message: string;
  data?: T;
}

// ==================== UTILITY TYPES ====================

export type AsyncFunction<T> = () => Promise<T>;
export type AsyncVoidFunction = () => Promise<void>;

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = Nullable<T> | Optional<T>;

export interface TimeRange {
  from: Date;
  to: Date;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface Range<T> {
  min: T;
  max: T;
}

// ==================== CONSTANTS ====================

export const CLIENT_STATUS_OPTIONS = [
  { value: ClientStatus.NEW, label: 'New' },
  { value: ClientStatus.INTERESTED, label: 'Interested' },
  { value: ClientStatus.DEAL_DONE, label: 'Deal Done' },
  { value: ClientStatus.REJECTED, label: 'Rejected' },
];

export const INQUIRY_TYPE_OPTIONS = [
  { value: InquiryType.BUY, label: 'Buy' },
  { value: InquiryType.SELL, label: 'Sell' },
  { value: InquiryType.RENT, label: 'Rent' },
];

export const REQUIREMENT_TYPE_OPTIONS = [
  { value: RequirementType.ONE_BHK, label: '1 BHK' },
  { value: RequirementType.TWO_BHK, label: '2 BHK' },
  { value: RequirementType.THREE_BHK, label: '3 BHK' },
  { value: RequirementType.STUDIO, label: 'Studio' },
  { value: RequirementType.PROPERTY, label: 'Property' },
  { value: RequirementType.LAND, label: 'Land' },
  { value: RequirementType.RENTAL, label: 'Rental' },
  { value: RequirementType.COMMERCIAL, label: 'Commercial' },
];

export const SUBSCRIPTION_PLANS: Record<SubscriptionType, SubscriptionPlan> = {
  [SubscriptionType.BASIC]: {
    type: SubscriptionType.BASIC,
    name: 'Basic',
    price: 999,
    currency: 'INR',
    features: [
      'Unlimited Clients',
      'Basic Reports',
      'Email Support',
    ],
    maxUsers: 1,
    durationDays: 30,
  },
  [SubscriptionType.PRO]: {
    type: SubscriptionType.PRO,
    name: 'Pro',
    price: 4999,
    currency: 'INR',
    features: [
      'Unlimited Clients',
      'Advanced Analytics',
      'Export Data',
      'Priority Support',
      'Up to 5 Users',
    ],
    maxUsers: 5,
    durationDays: 30,
  },
  [SubscriptionType.ENTERPRISE]: {
    type: SubscriptionType.ENTERPRISE,
    name: 'Enterprise',
    price: 9999,
    currency: 'INR',
    features: [
      'Everything in Pro',
      'Unlimited Users',
      'WhatsApp Automation',
      'Custom Integrations',
      'Dedicated Support',
    ],
    maxUsers: 999,
    durationDays: 30,
  },
};

// ==================== TYPE GUARDS ====================

export const isUser = (obj: any): obj is User => {
  return obj && typeof obj === 'object' && 'email' in obj && 'name' in obj;
};

export const isClient = (obj: any): obj is Client => {
  return obj && typeof obj === 'object' && 'clientName' in obj && 'phone' in obj;
};

export const isCommission = (obj: any): obj is Commission => {
  return (
    obj &&
    typeof obj === 'object' &&
    'dealAmount' in obj &&
    'commissionAmount' in obj
  );
};

export const isApiResponse = (obj: any): obj is ApiResponse<any> => {
  return obj && typeof obj === 'object' && 'success' in obj && 'message' in obj;
};
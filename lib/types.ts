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

export enum PropertyType {
  FLAT = 'Flat',
  HOUSE = 'House',
  VILLA = 'Villa',
  PLOT = 'Plot',
  LAND = 'Land',
  COMMERCIAL = 'Commercial',
  SHOP = 'Shop',
  OFFICE = 'Office',
  WAREHOUSE = 'Warehouse',
}

export enum BHKType {
  STUDIO = 'Studio',
  ONE_BHK = '1BHK',
  TWO_BHK = '2BHK',
  THREE_BHK = '3BHK',
  FOUR_BHK = '4BHK',
  FIVE_BHK = '5BHK',
}

export enum PropertyStatus {
  AVAILABLE = 'Available',
  RENTED = 'Rented',
  SOLD = 'Sold',
  UNAVAILABLE = 'Unavailable',
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

// ==================== BASE MODEL ====================

export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== COMPANY ====================

export interface Company extends BaseModel {
  companyName: string;
  logo?: string;
  subscriptionType: SubscriptionType;
  subscriptionExpiry: Date;
  status: CompanyStatus;
}

// ==================== USER ====================

export interface User extends BaseModel {
  name: string;
  phone: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: string;
  profilePhoto?: string;
  status: string;

  company?: Company;
}

export type UserWithoutPassword = Omit<User, 'password'>;

// ==================== CLIENT ====================

export interface Client extends BaseModel {
  clientName: string;
  phone: string;
  email?: string;
  companyName?: string;

  requirementType: RequirementType;
  inquiryType: InquiryType;
  status: ClientStatus;

  propertyVisited?: boolean;
  visitStatus?: string;

  budget?: number;
  preferredLocation?: string;
  address?: string;

  visitingDate?: Date;
  visitingTime?: string;
  followUpDate?: Date;

  source?: string;
  notes?: string;

  creatorId?: string;
  creator?: User;

  companyId?: string;
  company?: Company;
}

// ==================== CLIENT FORM (IMPORTANT) ====================

export type ClientFormValues = Omit<
  Client,
  'visitingDate' | 'followUpDate' | 'createdAt' | 'updatedAt'
> & {
  visitingDate?: string;     // ✅ MUST be string
  followUpDate?: string;     // ✅ MUST be string
};


// ==================== PROPERTY ====================

export interface Property extends BaseModel {
  propertyName: string;
  address: string;
  propertyType: PropertyType;
  bhkType?: string;
  vacateDate?: string;
  askingRent?: number;
  sellingPrice?: number;
  area?: string;
  description?: string;
  status: PropertyStatus;

  // Owner details
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;

  companyId?: string;
  createdBy?: string;
  creator?: User;
  company?: Company;
}

// ==================== COMMISSION ====================

export interface Commission extends BaseModel {
  clientId: string;
  userId: string;
  companyId: string;

  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidStatus: CommissionStatus;
  paymentDate?: Date;

  client?: Client;
  user?: User;
  company?: Company;
}

// ==================== OTP ====================

export interface OTP extends BaseModel {
  phone: string;
  otp: string;
  companyId: string;
  expiresAt: Date;

  company?: Company;
}

// ==================== INVOICE ====================

export interface Invoice extends BaseModel {
  companyId: string;
  invoiceNumber: string;
  amount: number;
  paymentStatus: string;
  planType: SubscriptionType;

  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  validFrom: Date;
  validUpto: Date;

  company?: Company;
}

// ==================== NOTIFICATIONS ====================

export type NotificationType =
  | 'visit_reminder'
  | 'followup_reminder'
  | 'commission_paid'
  | 'client_created'
  | 'system_alert';

export interface Notification extends BaseModel {
  userId: string;
  title: string;
  type: NotificationType;
  message: string;
  relatedId?: string;
  isRead: boolean;
  readAt?: Date;
}

// ==================== VISITS ====================

export interface TodayVisit {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  property?: string;
  location?: string;
  visitingDate: Date;
  visitingTime: string;
  assignedTo?: string;
}

export interface TodayVisitsResponse {
  visits: TodayVisit[];
  total: number;
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

export type CreateClientRequest = ClientFormValues;

export type UpdateClientRequest = Partial<CreateClientRequest>;

// ==================== API RESPONSES ====================

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
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

export interface ClientListResponse {
  clients: Client[];
  pagination: {
    total: number;
    pages: number;
    page: number;
  };
}

// ==================== ANALYTICS ====================

export interface AnalyticsResponse {
  summary: {
    totalClients: number;
    todayVisits: number;
    closedDeals: number;
    totalCommission: number;
  };

  leadsByStatus: Array<{
    status: ClientStatus;
    count: number;
  }>;

  monthlyData: Array<{
    month: string;
    leads: number;
    deals: number;
  }>;
}

// ==================== AUTH ====================

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

// ==================== COMMON TYPES ====================


export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface Range<T> {
  min: T;
  max: T;
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

export const PROPERTY_TYPE_OPTIONS = [
  { value: PropertyType.FLAT, label: 'Flat' },
  { value: PropertyType.HOUSE, label: 'House' },
  { value: PropertyType.VILLA, label: 'Villa' },
  { value: PropertyType.PLOT, label: 'Plot' },
  { value: PropertyType.LAND, label: 'Land' },
  { value: PropertyType.COMMERCIAL, label: 'Commercial' },
  { value: PropertyType.SHOP, label: 'Shop' },
  { value: PropertyType.OFFICE, label: 'Office' },
  { value: PropertyType.WAREHOUSE, label: 'Warehouse' },
];

export const PROPERTY_STATUS_OPTIONS = [
  { value: PropertyStatus.AVAILABLE, label: 'Available' },
  { value: PropertyStatus.RENTED, label: 'Rented' },
  { value: PropertyStatus.SOLD, label: 'Sold' },
  { value: PropertyStatus.UNAVAILABLE, label: 'Unavailable' },
];

export const BHK_TYPE_OPTIONS = [
  { value: BHKType.STUDIO, label: 'Studio' },
  { value: BHKType.ONE_BHK, label: '1 BHK' },
  { value: BHKType.TWO_BHK, label: '2 BHK' },
  { value: BHKType.THREE_BHK, label: '3 BHK' },
  { value: BHKType.FOUR_BHK, label: '4 BHK' },
  { value: BHKType.FIVE_BHK, label: '5 BHK' },
];

/** Property types that should show the BHK sub-type selector */
export const PROPERTY_TYPES_WITH_BHK: string[] = [
  PropertyType.FLAT,
  PropertyType.HOUSE,
  PropertyType.VILLA,
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
export interface SubscriptionPlan {
  type: SubscriptionType;
  name: string;
  price: number;
  currency: string;
  features: string[];
  maxUsers: number;
  durationDays: number;
  isPopular?: boolean;
}
export const SUBSCRIPTION_PLANS: Record<
  SubscriptionType,
  SubscriptionPlan
> = {
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
    isPopular: false,
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
    isPopular: true, // 🔥 Highlight in UI
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
    isPopular: false,
  },
};

// ==================== TYPE GUARDS ====================

export const isUser = (obj: unknown): obj is User => {
  return obj != null && typeof obj === 'object' && 'email' in obj && 'name' in obj;
};

export const isClient = (obj: unknown): obj is Client => {
  return obj != null && typeof obj === 'object' && 'clientName' in obj && 'phone' in obj;
};

export const isCommission = (obj: unknown): obj is Commission => {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'dealAmount' in obj &&
    'commissionAmount' in obj
  );
};

export const isApiResponse = (obj: unknown): obj is ApiResponse<unknown> => {
  return obj != null && typeof obj === 'object' && 'success' in obj && 'message' in obj;
};
// ==================== ENUMS ====================
export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
}

export enum SaleCondition {
  NEW = 'new',
  USED = 'used',
}

export enum CollectionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  RETURNED = 'returned',
}

// ==================== AUTH ====================
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

export interface SetupPasswordDto {
  token: string;
  password: string;
}

export interface RegisterStaffDto {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

// ==================== USER ====================
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isPasswordSet: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}

// ==================== CREDITS ====================
export enum CreditStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  DEFAULTED = 'defaulted',
}

export interface CreditPaymentHistory {
  date: string;
  note: string;
  amount: number;
}

export interface Credit {
  id: string;
  inventoryId: string;
  saleId: string | null;
  date: string;
  productName: string;
  imei: string;
  storageGB: string;
  color: string;
  amount: string;
  amountPaid: string;
  remainingBalance: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  dueDate: string;
  status: CreditStatus;
  paymentHistory: CreditPaymentHistory[];
  isVoided: boolean;
  voidReason: string | null;
  voidedAt: string | null;
  createdById: string;
  createdAt: string;
}

export interface CreditStats {
  totalCredits: number;
  totalCreditAmount: number;
  totalPaid: number;
  outstandingBalance: number;
  byStatus: Record<CreditStatus, number>;
  conversionRate: number;
  overdueCredits: Credit[];
}

// ==================== COLLECTIONS STATS ====================
interface CollectionsPeriodStats {
  total: number;
  pending: number;
  paid: number;
  returned: number;
  conversionRate: number;
}

export interface CollectionsStats {
  allTime: CollectionsPeriodStats & { totalRevenue: number };
  thisMonth: CollectionsPeriodStats & { revenue: number };
}

// ==================== PROFIT REPORT ====================
export interface ProfitReportSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  totalSales: number;
  averageSale: number;
}

export interface ProfitByProduct {
  productName: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface ProfitByStaff {
  staffName: string;
  totalSales: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface ProfitReport {
  period: { startDate: string; endDate: string };
  summary: ProfitReportSummary;
  byProduct: ProfitByProduct[];
  byStaff: ProfitByStaff[];
}

// ==================== DASHBOARD PERIODS ====================
interface PeriodSalesMetrics {
  count: number;
  revenue: number;
  cost: number;
  profit: number;
  averageSale: number;
}

interface PeriodCollections {
  total: number;
  pending: number;
  paid: number;
  returned: number;
}

export interface PeriodBreakdownItem {
  date: string;
  count: string;
  revenue: string;
  cost: string;
}

export interface TopProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
}

export interface DailySummary {
  date: string;
  sales: PeriodSalesMetrics;
  collections: PeriodCollections;
}

export interface WeeklySummary {
  period: { start: string; end: string };
  sales: PeriodSalesMetrics;
  collections: PeriodCollections;
  dailyBreakdown: PeriodBreakdownItem[];
}

export interface MonthlySummary {
  period: { start: string; end: string; month: string };
  sales: PeriodSalesMetrics & { profitMargin: number };
  collections: PeriodCollections;
  dailyBreakdown: PeriodBreakdownItem[];
}

export interface UserPerformance {
  user_id: string;
  user_email: string;
  user_firstName: string;
  user_lastName: string;
  totalsales: string;
  totalrevenue: string;
}

// ==================== INVENTORY ====================
export interface InventoryItem {
  id: string;
  serialNumber: string;
  dateAdded: string;
  productName: string;
  imei: string;
  storageGB: number;
  color: string;
  productType: string;
  companyName: string;
  costPrice: number;
  sellingPrice: number;
  thresholdPrice: number;
  isAvailable: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryDto {
  dateAdded: string;
  productName: string;
  imei: string;
  storageGB: number;
  color: string;
  productType: string;
  companyName: string;
  costPrice: number;
  sellingPrice: number;
  thresholdPrice: number;
}

export interface UpdateInventoryDto {
  productName?: string;
  imei?: string;
  storageGB?: number;
  color?: string;
  productType?: string;
  companyName?: string;
  costPrice?: number;
  sellingPrice?: number;
  thresholdPrice?: number;
}

// ==================== SALES ====================
export interface Sale {
  id: string;
  serialNumber: string;
  date: string;
  productName: string;
  imei: string;
  storageGB: string;
  color: string;
  amount: number;
  costPrice: number;
  thresholdPrice: number;
  condition: SaleCondition;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  accountPaidTo: string;
  createdById: string;
  createdAt: string;
}

export interface CreateSaleDto {
  inventoryId: string;
  date?: string;
  amount: number;
  condition: SaleCondition;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  accountPaidTo: string;
}

// ==================== COLLECTIONS ====================
export interface Collection {
  id: string;
  serialNumber: string;
  date: string;
  productName: string;
  imei: string;
  storageGB: string;
  color: string;
  amount: number;
  collectorName: string;
  status: CollectionStatus;
  createdById: string;
  createdAt: string;
}

export interface CreateCollectionDto {
  inventoryId: string;
  date?: string;
  amount: number;
  collectorName: string;
}

// ==================== ACTIVITY LOGS ====================
export interface ActivityLog {
  id: string;
  userId: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
  action: string;
  description: string;
  timestamp: string;
}

// ==================== API RESPONSES ====================
export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ErrorResponse {
  success: false;
  message: string | string[];
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
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

export interface CreateCreditDto {
  inventoryId: string;
  date: string;
  amount: number;
  amountPaid?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  dueDate: string;
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

// ==================== CATEGORIES ====================
export interface Category {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== SUPPLIERS ====================
export interface Supplier {
  id: number;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== INVENTORY ====================
export type InventoryUnit = 'kg' | 'piece' | 'litre' | 'pack' | 'bag' | 'carton' | 'dozen';

export interface InventoryItem {
  id: string;
  serialNumber?: string;
  dateAdded: string;
  productName: string;
  quantity: number;
  unit: InventoryUnit;
  costPrice: number;
  sellingPrice: number;
  categoryId: string;
  category?: { id: string; name: string };
  supplierRef?: string;
  restockThreshold: number;
  expiryTracking: boolean;
  expiryDate?: string;
  isAvailable?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryDto {
  productName: string;
  quantity: number;
  unit: InventoryUnit;
  costPrice: number;
  sellingPrice: number;
  categoryId: string;
  supplierRef?: string;
  restockThreshold: number;
  expiryTracking?: boolean;
  expiryDate?: string;
  dateAdded: string;
}

export interface UpdateInventoryDto {
  productName?: string;
  quantity?: number;
  unit?: InventoryUnit;
  costPrice?: number;
  sellingPrice?: number;
  categoryId?: string;
  supplierRef?: string;
  restockThreshold?: number;
  expiryTracking?: boolean;
  expiryDate?: string;
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
  customerId?: string;
  accountPaidTo: string;
  isVendor?: boolean;
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

// ==================== CUSTOMERS ====================
export interface CustomerCreditPurchases {
  totalCredits: number;
  totalCreditAmount: number;
  totalPaid: number;
}

export interface Customer {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  totalPurchases: number;
  totalSpent: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  creditPurchases: CustomerCreditPurchases;
}

export interface Vendor {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  purchaseCount: number;
  totalPurchases: string;
  isVendor: boolean;
  createdAt: string;
  updatedAt: string;
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

// ==================== INCOMING ORDERS ====================
export enum IncomingOrderStatus {
  PENDING = 'pending',
  CONVERTED = 'converted',
  CANCELLED = 'cancelled',
}

export interface IncomingOrder {
  id: string;
  date: string;
  expiryDate: string;
  expectedAmount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  status: IncomingOrderStatus;
  createdAt: string;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string; role: string };
  inventoryId?: string;
  inventory?: {
    id: string;
    productName: string;
    color: string;
    storageGB: string;
    imei: string;
  };
}

export interface CreateIncomingOrderDto {
  inventoryId?: string;
  date: string;
  expiryDate: string;
  expectedAmount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
}

export interface IncomingOrderStats {
  total: number;
  byStatus: Record<IncomingOrderStatus, number>;
}

// ==================== REPORTS ====================
export interface SalesTopProduct {
  productName: string;
  qtySold: number;
  revenue: number;
  date: string;
}

export interface SalesReport {
  period: { startDate: string; endDate: string };
  summary: {
    totalSales: number;
    totalRevenue: number;
    averageSaleValue: number;
    topProduct: { name: string; qtySold: number; revenue: number } | null;
  };
  topProducts: SalesTopProduct[];
  dailyBreakdown: { date: string; totalSales: number; revenue: number }[];
}

export interface StockReportItem {
  id: string;
  productName: string;
  quantity: number;
  restockThreshold: number;
  unit: string;
  categoryId: number;
  categoryName: string | null;
  supplierRef: string | null;
  isLowStock: boolean;
  isAvailable: boolean;
}

export interface StockReport {
  totalProducts: number;
  lowStockCount: number;
  items: StockReportItem[];
}

export interface CategoryReportItem {
  categoryId: number;
  categoryName: string;
  unitsSold: number;
  totalTransactions: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
}

export interface CategoryReport {
  period: { startDate: string; endDate: string };
  categories: CategoryReportItem[];
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
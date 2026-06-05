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
}

export interface WeeklySummary {
  period: { start: string; end: string };
  sales: PeriodSalesMetrics;
  dailyBreakdown: PeriodBreakdownItem[];
}

export interface MonthlySummary {
  period: { start: string; end: string; month: string };
  sales: PeriodSalesMetrics & { profitMargin: number };
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
export type InventoryUnit = 'carton' | 'bag' | 'bottle' | 'pack' | 'piece' | 'dozen' | 'gallon' | 'crate' | 'bucket' | 'box';

export interface InventoryItem {
  id: string;
  serialNumber?: string;
  dateAdded: string;
  productName: string;
  quantity: number;
  unit: InventoryUnit;
  variant: string;
  costPrice: number;
  sellingPrice: number;
  categoryId: number;
  category?: { id: number; name: string };
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
  variant: string;
  costPrice?: number;
  sellingPrice: number;
  categoryId: number;
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
  variant?: string;
  costPrice?: number;
  sellingPrice?: number;
  categoryId?: number;
  supplierRef?: string;
  restockThreshold?: number;
  expiryTracking?: boolean;
  expiryDate?: string;
}

// ==================== SALES ====================
export interface Sale {
  id: string;
  inventoryId: string;
  transactionId: string;
  date: string;
  productName: string;
  quantity: number;
  amount: number;
  costPrice: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  accountPaidTo: string;
  isVendor: boolean;
  createdById: string;
  createdBy?: { id: string; email: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface CreateSaleDto {
  inventoryId: string;
  date?: string;
  quantity?: number;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  accountPaidTo: string;
}

export interface BulkSaleItemDto {
  inventoryId: string;
  quantity: number;
  amount: number;
}

export interface BulkSaleDto {
  date?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  accountPaidTo: string;
  items: BulkSaleItemDto[];
}

export type SaleSubmitPayload =
  | { type: 'single'; data: CreateSaleDto }
  | { type: 'bulk'; data: BulkSaleDto };

export interface SaleItem {
  id: string;
  inventoryId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  costPrice: number;
}

export interface SaleTransaction {
  transactionId: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  accountPaidTo: string;
  isVendor: boolean;
  createdById: string;
  createdBy?: { id: string; email: string; firstName: string; lastName: string };
  createdAt: string;
  itemCount: number;
  total: number;
  items: SaleItem[];
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
  variant?: string;
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

// ==================== EXPENSES ====================
export type ExpenseCategoryType = 'overhead' | 'operational' | 'other';

export interface ExpenseCategory {
  id: number;
  name: string;
  type: ExpenseCategoryType;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseCategoryDto {
  name: string;
  type?: ExpenseCategoryType;
  description?: string;
}

export interface UpdateExpenseCategoryDto {
  name?: string;
  type?: ExpenseCategoryType;
  description?: string;
  isActive?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  categoryId: number;
  category: { id: number; name: string; type: ExpenseCategoryType };
  description?: string | null;
  amount: number;
  paidTo: string;
  recordedById: string;
  recordedBy?: { id: string; firstName: string; lastName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseDto {
  date: string;
  categoryId: number;
  description?: string;
  amount: number;
  paidTo: string;
}

export interface UpdateExpenseDto {
  date?: string;
  categoryId?: number;
  description?: string;
  amount?: number;
  paidTo?: string;
}

export interface ExpenseSummaryByCategory {
  categoryId: number;
  categoryName: string;
  type: ExpenseCategoryType;
  total: number;
  count: number;
}

export interface ExpenseSummaryByMonth {
  month: string;
  total: number;
}

export interface ExpenseSummary {
  totalAmount: number;
  byCategory: ExpenseSummaryByCategory[];
  byMonth: ExpenseSummaryByMonth[];
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
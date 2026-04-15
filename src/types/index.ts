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
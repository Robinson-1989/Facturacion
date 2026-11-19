export type BranchCode = 'SUC-01' | 'SUC-02' | 'SUC-03';
export type GlobalBranchFilter = 'ALL' | BranchCode;
export type UserRole = 'SUPERADMIN' | 'ENCARGADO' | 'CAJERO';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'SEGURO_MEDICO';
export type DateFilterMode = 'DAY' | 'RANGE' | 'MONTH' | 'YEAR';
export type NcfType = 'B02' | 'B01' | 'B14' | 'B15';
export type InvoiceType = 'CONTADO' | 'CREDITO' | 'SEGURO' | 'DOMICILIO';
export type SaleUnit = 'UNID' | 'BLIS' | 'CAJA';

export interface Client {
  id: number;
  code: string;
  name: string;
  rncOrCedula: string;
  phone: string;
  address: string;
  defaultDiscountPct: number;
  arsProvider?: string;
  arsPolicyNo?: string;
}

export interface Branch {
  id: BranchCode;
  name: string;
  rnc: string;
  address: string;
  phone: string;
  color: string;
}

export interface Product {
  id: number;
  barcode: string;
  commercialName: string;
  activeIngredient: string;
  laboratory: string;
  presentation: string;
  costPrice: number;
  salePrice: number;
  taxPct: number; // ej. 18 o 0
  requiresPrescription: boolean;
}

export interface Lot {
  id: number;
  branchId: BranchCode;
  productId: number;
  lotNumber: string;
  expiryDate: string; // YYYY-MM-DD
  availableQty: number;
  unitCost: number;
  aisle: string;
  minStock: number;
}

export interface SaleLine {
  productId: number;
  productName: string;
  lotId: number;
  lotNumber: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  tax: number;
  lineTotal: number;
  unit?: SaleUnit;
  bonusQty?: number;
  exempt?: boolean;
  coverage100?: boolean;
  discountPct?: number;
}

export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  branchId: BranchCode;
  cashierName: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalSale: number;
  totalCogs: number;
  lines: SaleLine[];
  status?: 'CONFIRMADA' | 'ANULADA';
  voidReason?: string;
  clientId?: number;
  clientName?: string;
  clientRnc?: string;
  clientPhone?: string;
  sellerName?: string;
  invoiceType?: InvoiceType;
  ncfType?: NcfType;
  ncf?: string;
  authorizationNo?: string;
  controlledRxNo?: string;
  conduceNo?: string;
  orderNo?: string;
  coveragePct?: number;
  coverageAmount?: number;
  amountReceived?: number;
  changeDue?: number;
  note?: string;
  isDelivery?: boolean;
  deliveryStatus?: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO';
  deliveryAddress?: string;
}

export interface PosCartItem {
  productId: number;
  qty: number;
  bonusQty: number;
  unit: SaleUnit;
  unitPrice: number;
  discountPct: number;
  exempt: boolean;
  coverage100: boolean;
}

export interface HeldInvoice {
  id: string;
  branchId: BranchCode;
  savedAt: string;
  clientId: number;
  clientName: string;
  invoiceType: InvoiceType;
  ncfType: NcfType;
  paymentMethod: PaymentMethod;
  globalDiscountPct: number;
  coveragePct: number;
  authorizationNo: string;
  controlledRxNo: string;
  note: string;
  items: PosCartItem[];
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  branchId: BranchCode;
  date: string;
  clientId: number;
  clientName: string;
  note: string;
  items: PosCartItem[];
  estimatedTotal: number;
}

export interface TransferRequest {
  id: string;
  fromBranchId: BranchCode;
  toBranchId: BranchCode;
  productId: number;
  productName: string;
  qty: number;
  status: 'SOLICITADO' | 'COMPLETADO';
  requestedBy: string;
  date: string;
}

export interface Employee {
  id: number;
  branchId: BranchCode;
  documentId: string;
  fullName: string;
  position: string;
  baseSalary: number;
  commissionPct: number;
  hireDate: string;
  active: boolean;
}

export interface PayrollRecord {
  id: string;
  branchId: BranchCode;
  employeeId: number;
  employeeName: string;
  periodType: 'QUINCENAL' | 'MENSUAL';
  periodLabel: string;
  paymentDate: string; // YYYY-MM-DD
  grossSalary: number;
  commissions: number;
  bonuses: number;
  legalDeductions: number;
  netPay: number;
  status: 'PENDIENTE' | 'PAGADA';
}

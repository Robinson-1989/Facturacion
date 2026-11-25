'use client';

import React, { createContext, useContext, useState } from 'react';
import {
  BranchCode,
  Client,
  Employee,
  GlobalBranchFilter,
  HeldInvoice,
  InvoiceType,
  Lot,
  NcfType,
  PaymentMethod,
  PayrollRecord,
  PosCartItem,
  Product,
  Quotation,
  SaleLine,
  SaleRecord,
  SaleUnit,
  TransferRequest,
  UserRole,
} from '@/types/pharmacy';
import {
  INITIAL_CLIENTS,
  INITIAL_EMPLOYEES,
  INITIAL_LOTS,
  INITIAL_PAYROLL,
  INITIAL_PRODUCTS,
  INITIAL_QUOTATIONS,
  INITIAL_SALES,
  INITIAL_TRANSFERS,
} from '@/data/mockData';

interface CartItemInput {
  productId: number;
  qty: number;
  discountPct: number;
  bonusQty?: number;
  unit?: SaleUnit;
  unitPrice?: number;
  exempt?: boolean;
  coverage100?: boolean;
}

export interface PosSaleOptions {
  clientId?: number;
  clientName?: string;
  clientRnc?: string;
  clientPhone?: string;
  sellerName?: string;
  cashierName?: string;
  invoiceType?: InvoiceType;
  ncfType?: NcfType;
  authorizationNo?: string;
  controlledRxNo?: string;
  conduceNo?: string;
  orderNo?: string;
  globalDiscountPct?: number;
  coveragePct?: number;
  amountReceived?: number;
  note?: string;
  isDelivery?: boolean;
  deliveryAddress?: string;
}

interface AppContextValue {
  role: UserRole;
  assignedBranch: BranchCode;
  globalBranch: GlobalBranchFilter;
  setRoleAndBranch: (role: UserRole, branch?: BranchCode) => void;
  setGlobalBranch: (branch: GlobalBranchFilter) => void;
  products: Product[];
  lots: Lot[];
  sales: SaleRecord[];
  clients: Client[];
  heldInvoices: HeldInvoice[];
  quotations: Quotation[];
  employees: Employee[];
  payrolls: PayrollRecord[];
  transfers: TransferRequest[];
  processPosSale: (
    branchId: BranchCode,
    items: CartItemInput[],
    paymentMethod: PaymentMethod,
    options?: PosSaleOptions
  ) => { ok: boolean; sale?: SaleRecord; error?: string };
  voidSale: (saleId: string, reason: string) => { ok: boolean; error?: string };
  updateDeliveryStatus: (saleId: string, status: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO') => void;
  addClient: (client: Omit<Client, 'id' | 'code'>) => Client;
  holdInvoice: (invoice: Omit<HeldInvoice, 'id' | 'savedAt'>) => HeldInvoice;
  removeHeldInvoice: (id: string) => void;
  saveQuotation: (quote: Omit<Quotation, 'id' | 'quoteNumber' | 'date'>) => Quotation;
  removeQuotation: (id: string) => void;
  requestTransfer: (
    fromBranchId: BranchCode,
    toBranchId: BranchCode,
    productId: number,
    qty: number
  ) => void;
  completeTransfer: (transferId: string) => void;
  payPayroll: (payrollId: string) => void;
  generatePayrollForBranch: (
    branchId: BranchCode,
    periodType: 'QUINCENAL' | 'MENSUAL'
  ) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('SUPERADMIN');
  const [assignedBranch, setAssignedBranch] = useState<BranchCode>('SUC-01');
  const [globalBranch, setGlobalBranchState] = useState<GlobalBranchFilter>('ALL');

  const [products] = useState<Product[]>(INITIAL_PRODUCTS);
  const [lots, setLots] = useState<Lot[]>(INITIAL_LOTS);
  const [sales, setSales] = useState<SaleRecord[]>(INITIAL_SALES);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>(INITIAL_QUOTATIONS);
  const [employees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(INITIAL_PAYROLL);
  const [transfers, setTransfers] = useState<TransferRequest[]>(INITIAL_TRANSFERS);

  const setRoleAndBranch = (newRole: UserRole, branch: BranchCode = 'SUC-01') => {
    setRole(newRole);
    setAssignedBranch(branch);
    if (newRole === 'SUPERADMIN') {
      setGlobalBranchState('ALL');
    } else {
      setGlobalBranchState(branch);
    }
  };

  const setGlobalBranch = (branch: GlobalBranchFilter) => {
    if (role !== 'SUPERADMIN') return;
    setGlobalBranchState(branch);
  };

  // Procesamiento transaccional FEFO (First Expired, First Out)
  const processPosSale = (
    branchId: BranchCode,
    items: CartItemInput[],
    paymentMethod: PaymentMethod,
    options?: PosSaleOptions
  ): { ok: boolean; sale?: SaleRecord; error?: string } => {
    if (items.length === 0) {
      return { ok: false, error: 'El carrito está vacío.' };
    }

    const updatedLots = lots.map((l) => ({ ...l }));
    const saleLines: SaleLine[] = [];
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let totalCogs = 0;

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return { ok: false, error: 'Producto no encontrado.' };

      const bonusQty = item.bonusQty ?? 0;
      const totalUnitsNeeded = item.qty + bonusQty;

      // Lotes disponibles ordenados por fecha de vencimiento más próxima (FEFO)
      const branchLots = updatedLots
        .filter(
          (l) =>
            l.branchId === branchId &&
            l.productId === item.productId &&
            l.availableQty > 0
        )
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      const totalStock = branchLots.reduce((sum, l) => sum + l.availableQty, 0);
      if (totalStock < totalUnitsNeeded) {
        return {
          ok: false,
          error: `Stock insuficiente para ${product.commercialName} (requerido: ${totalUnitsNeeded}, disponible: ${totalStock}).`,
        };
      }

      const effectivePrice = item.unitPrice ?? product.salePrice;
      const isExempt = item.exempt ?? product.taxPct === 0;
      const effectiveTaxPct = isExempt ? 0 : product.taxPct > 0 ? product.taxPct : 18;

      let remainingBillable = item.qty;
      let remainingTotal = totalUnitsNeeded;

      for (const lot of branchLots) {
        if (remainingTotal <= 0) break;
        const take = Math.min(remainingTotal, lot.availableQty);
        lot.availableQty -= take;
        remainingTotal -= take;

        const billableTake = Math.min(take, remainingBillable);
        remainingBillable -= billableTake;

        const lineGross = +(billableTake * effectivePrice).toFixed(2);
        const lineDisc = +(lineGross * (item.discountPct / 100)).toFixed(2);
        const taxable = lineGross - lineDisc;
        const lineTax = +(taxable * (effectiveTaxPct / 100)).toFixed(2);
        const lineTotal = +(taxable + lineTax).toFixed(2);

        subtotal += lineGross;
        discountTotal += lineDisc;
        taxTotal += lineTax;
        totalCogs += take * lot.unitCost;

        saleLines.push({
          productId: product.id,
          productName: product.commercialName,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          qty: billableTake,
          unitPrice: effectivePrice,
          unitCost: lot.unitCost,
          discount: lineDisc,
          tax: lineTax,
          lineTotal,
          unit: item.unit ?? 'UNID',
          bonusQty: take - billableTake,
          exempt: isExempt,
          coverage100: item.coverage100 ?? false,
          discountPct: item.discountPct,
        });
      }
    }

    const globalDiscPct = options?.globalDiscountPct ?? 0;
    const netBeforeGlobalDisc = subtotal - discountTotal;
    const extraGlobalDisc = +(netBeforeGlobalDisc * (globalDiscPct / 100)).toFixed(2);
    discountTotal = +(discountTotal + extraGlobalDisc).toFixed(2);
    if (globalDiscPct > 0) {
      taxTotal = +(taxTotal * (1 - globalDiscPct / 100)).toFixed(2);
    }

    const totalSale = +(subtotal - discountTotal + taxTotal).toFixed(2);
    const coveragePct = options?.coveragePct ?? 0;
    const coverageAmount = +(totalSale * (coveragePct / 100)).toFixed(2);
    const patientPayable = +(totalSale - coverageAmount).toFixed(2);
    const amountReceived = options?.amountReceived ?? patientPayable;
    const changeDue = Math.max(0, +(amountReceived - patientPayable).toFixed(2));

    const ncfType: NcfType = options?.ncfType ?? 'B02';
    const branchSalesCount = sales.filter((s) => s.branchId === branchId).length;
    const ncfSequence = String(branchSalesCount + 105).padStart(8, '0');
    const generatedNcf = `${ncfType}${ncfSequence}`;

    const today = new Date().toISOString().slice(0, 10);
    const newSale: SaleRecord = {
      id: `V-${Date.now()}`,
      invoiceNumber: `FAC-${branchId.slice(-2)}-${String(branchSalesCount + 105).padStart(6, '0')}`,
      date: today,
      timestamp: new Date().toISOString(),
      branchId,
      cashierName:
        options?.cashierName ||
        (role === 'SUPERADMIN'
          ? 'Dueño (SuperAdmin)'
          : role === 'ENCARGADO'
          ? 'Encargado de Sucursal'
          : 'Cajero POS'),
      paymentMethod,
      subtotal: +subtotal.toFixed(2),
      discountTotal: +discountTotal.toFixed(2),
      taxTotal: +taxTotal.toFixed(2),
      totalSale,
      totalCogs: +totalCogs.toFixed(2),
      lines: saleLines,
      status: 'CONFIRMADA',
      clientId: options?.clientId ?? 1,
      clientName: options?.clientName ?? 'VENTAS AL CONTADO',
      clientRnc: options?.clientRnc ?? '',
      clientPhone: options?.clientPhone ?? '',
      sellerName: options?.sellerName ?? 'COMPAÑÍA',
      invoiceType: options?.invoiceType ?? 'CONTADO',
      ncfType,
      ncf: generatedNcf,
      authorizationNo: options?.authorizationNo ?? '',
      controlledRxNo: options?.controlledRxNo ?? '',
      conduceNo: options?.conduceNo ?? '',
      orderNo: options?.orderNo ?? '',
      coveragePct,
      coverageAmount,
      amountReceived,
      changeDue,
      note: options?.note ?? '',
      isDelivery: options?.isDelivery ?? options?.invoiceType === 'DOMICILIO',
      deliveryStatus:
        options?.isDelivery || options?.invoiceType === 'DOMICILIO' ? 'PENDIENTE' : undefined,
      deliveryAddress: options?.deliveryAddress ?? '',
    };

    setLots(updatedLots);
    setSales((prev) => [newSale, ...prev]);
    return { ok: true, sale: newSale };
  };

  const voidSale = (saleId: string, reason: string): { ok: boolean; error?: string } => {
    const target = sales.find((s) => s.id === saleId);
    if (!target) return { ok: false, error: 'Factura no encontrada.' };
    if (target.status === 'ANULADA') {
      return { ok: false, error: 'La factura ya fue anulada.' };
    }

    // Restaurar inventario FEFO a los lotes originales
    const updatedLots = lots.map((l) => ({ ...l }));
    for (const line of target.lines) {
      const lot = updatedLots.find((l) => l.id === line.lotId);
      if (lot) {
        lot.availableQty += line.qty + (line.bonusQty ?? 0);
      }
    }

    setLots(updatedLots);
    setSales((prev) =>
      prev.map((s) =>
        s.id === saleId
          ? { ...s, status: 'ANULADA', voidReason: reason || 'Anulación manual en POS' }
          : s
      )
    );
    return { ok: true };
  };

  const updateDeliveryStatus = (
    saleId: string,
    status: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO'
  ) => {
    setSales((prev) =>
      prev.map((s) => (s.id === saleId ? { ...s, deliveryStatus: status } : s))
    );
  };

  const addClient = (clientData: Omit<Client, 'id' | 'code'>): Client => {
    const nextId = clients.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const newClient: Client = {
      ...clientData,
      id: nextId,
      code: String(nextId),
    };
    setClients((prev) => [...prev, newClient]);
    return newClient;
  };

  const holdInvoice = (invoice: Omit<HeldInvoice, 'id' | 'savedAt'>): HeldInvoice => {
    const held: HeldInvoice = {
      ...invoice,
      id: `ESP-${Date.now()}`,
      savedAt: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    };
    setHeldInvoices((prev) => [held, ...prev]);
    return held;
  };

  const removeHeldInvoice = (id: string) => {
    setHeldInvoices((prev) => prev.filter((h) => h.id !== id));
  };

  const saveQuotation = (
    quote: Omit<Quotation, 'id' | 'quoteNumber' | 'date'>
  ): Quotation => {
    const newQuote: Quotation = {
      ...quote,
      id: `COT-${Date.now()}`,
      quoteNumber: `COT-${quote.branchId.slice(-2)}-${String(quotations.length + 20).padStart(6, '0')}`,
      date: new Date().toISOString().slice(0, 10),
    };
    setQuotations((prev) => [newQuote, ...prev]);
    return newQuote;
  };

  const removeQuotation = (id: string) => {
    setQuotations((prev) => prev.filter((q) => q.id !== id));
  };

  const requestTransfer = (
    fromBranchId: BranchCode,
    toBranchId: BranchCode,
    productId: number,
    qty: number
  ) => {
    const product = products.find((p) => p.id === productId);
    if (!product || fromBranchId === toBranchId || qty <= 0) return;
    const newTransfer: TransferRequest = {
      id: `TR-${String(transfers.length + 1).padStart(3, '0')}`,
      fromBranchId,
      toBranchId,
      productId,
      productName: product.commercialName,
      qty,
      status: 'SOLICITADO',
      requestedBy: role === 'SUPERADMIN' ? 'Dueño' : `Encargado ${toBranchId}`,
      date: new Date().toISOString().slice(0, 10),
    };
    setTransfers((prev) => [newTransfer, ...prev]);
  };

  const completeTransfer = (transferId: string) => {
    const tr = transfers.find((t) => t.id === transferId);
    if (!tr || tr.status === 'COMPLETADO') return;

    const updatedLots = lots.map((l) => ({ ...l }));
    const sourceLots = updatedLots
      .filter(
        (l) =>
          l.branchId === tr.fromBranchId &&
          l.productId === tr.productId &&
          l.availableQty > 0
      )
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    let remaining = tr.qty;
    let movedLotTemplate: Lot | null = null;
    for (const lot of sourceLots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.availableQty);
      lot.availableQty -= take;
      remaining -= take;
      movedLotTemplate = lot;
    }

    const actuallyMoved = tr.qty - remaining;
    if (actuallyMoved > 0 && movedLotTemplate) {
      const existingDest = updatedLots.find(
        (l) =>
          l.branchId === tr.toBranchId &&
          l.productId === tr.productId &&
          l.lotNumber === movedLotTemplate!.lotNumber
      );
      if (existingDest) {
        existingDest.availableQty += actuallyMoved;
      } else {
        updatedLots.push({
          id: Date.now(),
          branchId: tr.toBranchId,
          productId: tr.productId,
          lotNumber: `${movedLotTemplate.lotNumber}-TR`,
          expiryDate: movedLotTemplate.expiryDate,
          availableQty: actuallyMoved,
          unitCost: movedLotTemplate.unitCost,
          aisle: 'Recepción / Traslado',
          minStock: movedLotTemplate.minStock,
        });
      }
      setLots(updatedLots);
    }

    setTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, status: 'COMPLETADO' } : t))
    );
  };

  const payPayroll = (payrollId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setPayrolls((prev) =>
      prev.map((p) =>
        p.id === payrollId ? { ...p, status: 'PAGADA', paymentDate: today } : p
      )
    );
  };

  const generatePayrollForBranch = (
    branchId: BranchCode,
    periodType: 'QUINCENAL' | 'MENSUAL'
  ) => {
    const factor = periodType === 'QUINCENAL' ? 0.5 : 1;
    const branchEmployees = employees.filter(
      (e) => e.branchId === branchId && e.active
    );
    const today = new Date().toISOString().slice(0, 10);
    const newRecords: PayrollRecord[] = branchEmployees.map((emp) => {
      const gross = +(emp.baseSalary * factor).toFixed(2);
      const commissions = +(gross * (emp.commissionPct / 100) * 5).toFixed(2);
      const deductions = +(gross * 0.089).toFixed(2);
      const net = +(gross + commissions - deductions).toFixed(2);
      return {
        id: `NOM-${Date.now()}-${emp.id}`,
        branchId,
        employeeId: emp.id,
        employeeName: emp.fullName,
        periodType,
        periodLabel:
          periodType === 'QUINCENAL' ? '2da Quincena Nov 2026' : 'Mes Nov 2026',
        paymentDate: today,
        grossSalary: gross,
        commissions,
        bonuses: 0,
        legalDeductions: deductions,
        netPay: net,
        status: 'PENDIENTE',
      };
    });
    setPayrolls((prev) => [...newRecords, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        role,
        assignedBranch,
        globalBranch,
        setRoleAndBranch,
        setGlobalBranch,
        products,
        lots,
        sales,
        clients,
        heldInvoices,
        quotations,
        employees,
        payrolls,
        transfers,
        processPosSale,
        voidSale,
        updateDeliveryStatus,
        addClient,
        holdInvoice,
        removeHeldInvoice,
        saveQuotation,
        removeQuotation,
        requestTransfer,
        completeTransfer,
        payPayroll,
        generatePayrollForBranch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}

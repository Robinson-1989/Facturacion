'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FilePlus2,
  Ban,
  Search,
  FileText,
  PauseCircle,
  PlayCircle,
  PackageSearch,
  History,
  UserCheck,
  Truck,
  ShieldCheck,
  Clock,
  Check,
  XCircle,
  UserPlus,
  ArrowRightLeft,
  Trash2,
  Barcode,
  Banknote,
  CreditCard,
  Building,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { BRANCHES } from '@/data/mockData';
import {
  BranchCode,
  HeldInvoice,
  InvoiceType,
  NcfType,
  PaymentMethod,
  PosCartItem,
  Quotation,
  SaleRecord,
  SaleUnit,
} from '@/types/pharmacy';
import {
  DeliveryQueueModal,
  HeldInvoicesModal,
  InvoiceHistoryModal,
  NewClientModal,
  ProductLookupModal,
  QuotationsModal,
  ReceiptModal,
} from '@/components/pos/PosModals';

const NCF_LABELS: Record<NcfType, string> = {
  B02: 'CONSUMIDOR FINAL (B02)',
  B01: 'CRÉDITO FISCAL (B01)',
  B14: 'RÉGIMEN ESPECIAL (B14)',
  B15: 'GUBERNAMENTAL (B15)',
};

const CURRENCY_RATES = {
  USD: { symbol: '$', rate: 1, label: 'USD' },
  DOP: { symbol: 'RD$', rate: 60.5, label: 'Dólar→RD$' },
  EUR: { symbol: '€', rate: 0.92, label: 'Euro' },
} as const;

export default function PosModule() {
  const {
    globalBranch,
    assignedBranch,
    role,
    products,
    lots,
    sales,
    clients,
    heldInvoices,
    quotations,
    employees,
    processPosSale,
    voidSale,
    updateDeliveryStatus,
    addClient,
    holdInvoice,
    removeHeldInvoice,
    requestTransfer,
  } = useApp();

  const activeBranchId: BranchCode =
    role === 'SUPERADMIN'
      ? globalBranch === 'ALL'
        ? 'SUC-01'
        : globalBranch
      : assignedBranch;

  const activeBranch = BRANCHES.find((b) => b.id === activeBranchId)!;
  const branchEmployees = useMemo(
    () => employees.filter((e) => e.branchId === activeBranchId && e.active),
    [employees, activeBranchId]
  );

  // Refs para navegación rápida por teclado
  const inlineCodeRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const authInputRef = useRef<HTMLInputElement>(null);

  // Cabecera: Información del Cliente & Vendedor
  const [selectedClientId, setSelectedClientId] = useState<number>(1);
  const [clientAddress, setClientAddress] = useState('Mostrador General');
  const [clientRnc, setClientRnc] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [authorizationNo, setAuthorizationNo] = useState('');
  const [controlledRxNo, setControlledRxNo] = useState('');
  const [sellerName, setSellerName] = useState('COMPAÑÍA');
  const [cashierName, setCashierName] = useState(
    branchEmployees[0]?.fullName || 'RAYMIRA BELTRE CONTRERAS'
  );

  // Cabecera: Información de la Factura
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('CONTADO');
  const [conduceNo, setConduceNo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [ncfType, setNcfType] = useState<NcfType>('B02');
  const [autoAssignNumber, setAutoAssignNumber] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);

  // Líneas de productos + fila de entrada dinámica inline
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [inlineQuery, setInlineQuery] = useState('');
  const [showInlineDropdown, setShowInlineDropdown] = useState(false);

  // Totales, descuentos, ITBIS, cobertura y pago
  const [globalDiscountPct, setGlobalDiscountPct] = useState(0);
  const [applyItbisGlobal, setApplyItbisGlobal] = useState(true);
  const [itbisRate] = useState(18);
  const [coveragePct, setCoveragePct] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [amountReceived, setAmountReceived] = useState('');
  const [note, setNote] = useState('');
  const [currencyView, setCurrencyView] = useState<keyof typeof CURRENCY_RATES>('USD');

  // Estados de UI y modales
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showQuotesModal, setShowQuotesModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showCashierSelect, setShowCashierSelect] = useState(false);

  // Reloj en vivo
  const [liveDate, setLiveDate] = useState('');
  const [liveTime, setLiveTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setLiveDate(d.toLocaleDateString('es-DO'));
      setLiveTime(
        d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (branchEmployees.length > 0) {
      setCashierName(branchEmployees[0].fullName.toUpperCase());
    }
  }, [activeBranchId, branchEmployees]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? clients[0],
    [clients, selectedClientId]
  );

  const branchSalesCount = useMemo(
    () => sales.filter((s) => s.branchId === activeBranchId).length,
    [sales, activeBranchId]
  );
  const previewInvoiceNo = autoAssignNumber
    ? `FAC-${activeBranchId.slice(-2)}-${String(branchSalesCount + 105).padStart(6, '0')}`
    : 'No Asignado';
  const previewNcf = autoAssignNumber
    ? `${ncfType}${String(branchSalesCount + 105).padStart(8, '0')}`
    : 'No Asignado';

  // Productos con stock en la sucursal actual y en las otras 2 farmacias
  const branchProducts = useMemo(() => {
    const q = inlineQuery.trim().toLowerCase();
    return products
      .map((p) => {
        const pLots = lots
          .filter((l) => l.branchId === activeBranchId && l.productId === p.id && l.availableQty > 0)
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
        const stock = pLots.reduce((s, l) => s + l.availableQty, 0);
        const otherBranches = BRANCHES.filter((b) => b.id !== activeBranchId).map((b) => ({
          id: b.id,
          name: b.name.replace('Farmacia ', ''),
          qty: lots
            .filter((l) => l.branchId === b.id && l.productId === p.id && l.availableQty > 0)
            .reduce((s, l) => s + l.availableQty, 0),
        }));
        return { product: p, stock, nextLot: pLots[0], otherBranches };
      })
      .filter(
        (item) =>
          !q ||
          item.product.barcode.toLowerCase().includes(q) ||
          String(item.product.id) === q ||
          item.product.commercialName.toLowerCase().includes(q) ||
          item.product.activeIngredient.toLowerCase().includes(q)
      );
  }, [products, lots, activeBranchId, inlineQuery]);

  const hasControlledProduct = useMemo(
    () =>
      cart.some((row) => {
        const p = products.find((x) => x.id === row.productId);
        return p?.requiresPrescription;
      }),
    [cart, products]
  );

  // Cálculos dinámicos y automáticos
  const totals = useMemo(() => {
    let subtotal = 0;
    let lineDiscounts = 0;
    let tax = 0;
    let totalUnits = 0;

    cart.forEach((row) => {
      const gross = row.qty * row.unitPrice;
      const disc = gross * (row.discountPct / 100);
      const net = gross - disc;
      const p = products.find((x) => x.id === row.productId);
      const pct = !applyItbisGlobal || row.exempt ? 0 : p && p.taxPct > 0 ? p.taxPct : itbisRate;
      const itbis = net * (pct / 100);

      subtotal += gross;
      lineDiscounts += disc;
      tax += itbis;
      totalUnits += row.qty + row.bonusQty;
    });

    const afterLineDisc = subtotal - lineDiscounts;
    const globalDiscAmt = afterLineDisc * (globalDiscountPct / 100);
    const totalDiscount = lineDiscounts + globalDiscAmt;
    const adjustedTax = globalDiscountPct > 0 ? tax * (1 - globalDiscountPct / 100) : tax;
    const totalInvoice = Math.max(0, subtotal - totalDiscount + adjustedTax);
    const coverageAmount = totalInvoice * (coveragePct / 100);
    const patientTotal = Math.max(0, totalInvoice - coverageAmount);

    return {
      subtotal: +subtotal.toFixed(2),
      globalDiscAmt: +globalDiscAmt.toFixed(2),
      totalDiscount: +totalDiscount.toFixed(2),
      tax: +adjustedTax.toFixed(2),
      coverageAmount: +coverageAmount.toFixed(2),
      total: +patientTotal.toFixed(2),
      totalUnits,
    };
  }, [cart, products, globalDiscountPct, applyItbisGlobal, itbisRate, coveragePct]);

  const parsedReceived = Number(amountReceived);
  const effectiveReceived =
    paymentMethod === 'EFECTIVO' && amountReceived !== '' && !Number.isNaN(parsedReceived)
      ? parsedReceived
      : totals.total;
  const changeDue = Math.max(0, +(effectiveReceived - totals.total).toFixed(2));

  // Autocompletar cliente
  const handleSelectClient = (clientId: number) => {
    setSelectedClientId(clientId);
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    setClientAddress(c.address || '');
    setClientRnc(c.rncOrCedula || '');
    setClientPhone(c.phone || '');
    setGlobalDiscountPct(c.defaultDiscountPct || 0);
    if (c.rncOrCedula && c.rncOrCedula.replace(/\D/g, '').length >= 9) {
      setNcfType('B01');
    } else {
      setNcfType('B02');
    }
    if (c.arsProvider) {
      setNote((prev) => prev || `ARS: ${c.arsProvider} (${c.arsPolicyNo || 'N/A'})`);
    }
  };

  // Añadir producto desde buscador inline / escáner / modal
  const addToCart = (productId: number) => {
    setErrorMsg(null);
    setInfoMsg(null);
    const bp = branchProducts.find((x) => x.product.id === productId);
    if (!bp || bp.stock <= 0) {
      setErrorMsg('Sin stock disponible en esta sucursal. Puedes solicitar traslado abajo.');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId);
      if (existing) {
        if (existing.qty + existing.bonusQty >= bp.stock) {
          setErrorMsg(`Stock máximo alcanzado para ${bp.product.commercialName} (${bp.stock}).`);
          return prev;
        }
        return prev.map((c) =>
          c.productId === productId ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          productId,
          qty: 1,
          bonusQty: 0,
          unit: 'UNID',
          unitPrice: bp.product.salePrice,
          discountPct: 0,
          exempt: bp.product.taxPct === 0,
          coverage100: false,
        },
      ];
    });
    setSelectedRowId(productId);
  };

  const handleInlineEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = inlineQuery.trim().toLowerCase();
    if (!q) return;
    const exact =
      branchProducts.find((bp) => bp.product.barcode.toLowerCase() === q) ||
      branchProducts.find((bp) => String(bp.product.id) === q) ||
      branchProducts[0];
    if (exact) {
      addToCart(exact.product.id);
      setInlineQuery('');
      setShowInlineDropdown(false);
    }
  };

  const resetInvoice = () => {
    setCart([]);
    setSelectedRowId(null);
    setSelectedClientId(1);
    setClientAddress('Mostrador General');
    setClientRnc('');
    setClientPhone('');
    setAuthorizationNo('');
    setControlledRxNo('');
    setConduceNo('');
    setOrderNo('');
    setInvoiceType('CONTADO');
    setNcfType('B02');
    setPaymentMethod('EFECTIVO');
    setGlobalDiscountPct(0);
    setCoveragePct(0);
    setAmountReceived('');
    setNote('');
    setInlineQuery('');
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleHoldInvoice = () => {
    if (cart.length === 0) {
      setErrorMsg('Agrega al menos un producto para poner la factura en espera.');
      return;
    }
    holdInvoice({
      branchId: activeBranchId,
      clientId: selectedClientId,
      clientName: selectedClient.name,
      invoiceType,
      ncfType,
      paymentMethod,
      globalDiscountPct,
      coveragePct,
      authorizationNo,
      controlledRxNo,
      note,
      items: cart,
    });
    resetInvoice();
    setInfoMsg('Factura puesta en espera.');
  };

  const handleResumeHeld = (held: HeldInvoice) => {
    handleSelectClient(held.clientId);
    setInvoiceType(held.invoiceType);
    setNcfType(held.ncfType);
    setPaymentMethod(held.paymentMethod);
    setGlobalDiscountPct(held.globalDiscountPct);
    setCoveragePct(held.coveragePct);
    setAuthorizationNo(held.authorizationNo);
    setControlledRxNo(held.controlledRxNo);
    setNote(held.note);
    setCart(held.items);
    removeHeldInvoice(held.id);
    setInfoMsg(`Factura de ${held.clientName} recuperada.`);
  };

  const handleLoadQuotation = (quote: Quotation) => {
    handleSelectClient(quote.clientId);
    setCart(quote.items);
    setNote(quote.note);
    setInfoMsg(`Cotización ${quote.quoteNumber} cargada.`);
  };

  const handleSave = () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (cart.length === 0) {
      setErrorMsg('El área de productos está vacía.');
      return;
    }
    if (hasControlledProduct && !controlledRxNo.trim()) {
      setErrorMsg('Hay medicamentos controlados: ingresa el # Receta Ctrl.');
      return;
    }
    if ((invoiceType === 'SEGURO' || paymentMethod === 'SEGURO_MEDICO') && !authorizationNo.trim()) {
      setErrorMsg('Ingresa el número de Autorización ARS.');
      authInputRef.current?.focus();
      return;
    }

    const res = processPosSale(activeBranchId, cart, paymentMethod, {
      clientId: selectedClientId,
      clientName: selectedClient.name,
      clientRnc,
      clientPhone,
      sellerName,
      cashierName,
      invoiceType,
      ncfType,
      authorizationNo,
      controlledRxNo,
      conduceNo,
      orderNo,
      globalDiscountPct,
      coveragePct,
      amountReceived: effectiveReceived,
      note,
      isDelivery: invoiceType === 'DOMICILIO',
      deliveryAddress: clientAddress,
    });

    if (!res.ok) {
      setErrorMsg(res.error || 'Error al guardar factura.');
      return;
    }

    resetInvoice();
    if (autoPrint) {
      setLastSale(res.sale!);
    } else {
      setInfoMsg(`Factura ${res.sale!.invoiceNumber} (NCF: ${res.sale!.ncf}) guardada.`);
    }
  };

  // Atajos de teclado exactos [F2], [F3], [F4], [F5], [F7], [F8], [F9], [F12]
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        resetInvoice();
      } else if (e.key === 'F3' || e.key === 'F12') {
        e.preventDefault();
        inlineCodeRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldInvoice();
      } else if (e.key === 'F5') {
        e.preventDefault();
        setShowHeldModal(true);
      } else if (e.key === 'F7' && selectedRowId !== null) {
        e.preventDefault();
        setCart((prev) => prev.filter((c) => c.productId !== selectedRowId));
        setSelectedRowId(null);
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'F9') {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const inspectedItem = useMemo(() => {
    const targetId = selectedRowId ?? cart[cart.length - 1]?.productId;
    if (!targetId) return null;
    return branchProducts.find((bp) => bp.product.id === targetId) ?? null;
  }, [selectedRowId, cart, branchProducts]);

  const branchHeldCount = heldInvoices.filter((h) => h.branchId === activeBranchId).length;
  const pendingDeliveriesCount = sales.filter(
    (s) => s.isDelivery && s.status !== 'ANULADA' && s.deliveryStatus !== 'ENTREGADO'
  ).length;

  const curr = CURRENCY_RATES[currencyView];
  const fmtCurr = (usd: number) => `${curr.symbol}${(usd * curr.rate).toFixed(2)}`;

  return (
    <div className="flex flex-col rounded-xl border border-slate-300 bg-slate-100 shadow-sm">
      {/* BARRA DE TÍTULO TIPO VENTANA DE FACTURACIÓN */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-slate-300 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: activeBranch.color }}
          />
          <span>
            Facturación — {activeBranch.name.toUpperCase()} —{' '}
            {cart.length > 0 ? 'En Proceso' : 'Nuevo Registro'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
          <span>RNC: {activeBranch.rnc}</span>
          <span>·</span>
          <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
            FEFO Automático
          </span>
        </div>
      </div>

      {/* ALERTAS */}
      {errorMsg && (
        <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
          <span>⚠ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}
      {infoMsg && (
        <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          <span>✓ {infoMsg}</span>
          <button onClick={() => setInfoMsg(null)}>✕</button>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL: IZQUIERDA/CENTRO + PANEL LATERAL DERECHO DE BOTONES */}
      <div className="flex flex-col gap-3 p-3 lg:flex-row">
        {/* ÁREA PRINCIPAL DE FACTURACIÓN */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {/* FILA SUPERIOR: INFORMACIÓN DEL CLIENTE (+ VENDEDOR) | INFORMACIÓN DE LA FACTURA */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            {/* BLOQUE IZQUIERDO: INFORMACIÓN DEL CLIENTE + VENDEDOR */}
            <div className="flex flex-col gap-2 xl:col-span-7">
              <fieldset className="rounded-lg border border-slate-300 bg-white px-3 pb-3 pt-1.5">
                <legend className="px-1.5 text-xs font-bold text-slate-800">
                  Información del Cliente
                </legend>

                <div className="space-y-2 text-xs">
                  {/* Código + Nombre Cliente + Botón Nuevo */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={selectedClient.code}
                      className="w-12 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-center font-bold text-slate-800"
                    />
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleSelectClient(Number(e.target.value))}
                      className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.arsProvider ? `(${c.arsProvider})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewClientModal(true)}
                      title="Nuevo Cliente"
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-2 py-1 font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      ...
                    </button>
                  </div>

                  {/* Dirección / Detalles */}
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Dirección o referencia de entrega del cliente..."
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />

                  {/* RNC/Cédula | Autorización | # Receta Ctrl | Teléfono */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <label className="w-24 shrink-0 font-bold text-slate-700">RNC/Cédula</label>
                      <input
                        type="text"
                        value={clientRnc}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClientRnc(val);
                          if (val.replace(/\D/g, '').length >= 9 && ncfType === 'B02') {
                            setNcfType('B01');
                          }
                        }}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className={`w-24 shrink-0 font-bold ${
                          invoiceType === 'SEGURO' || paymentMethod === 'SEGURO_MEDICO'
                            ? 'text-blue-700'
                            : 'text-slate-700'
                        }`}
                      >
                        Autorización
                      </label>
                      <input
                        ref={authInputRef}
                        type="text"
                        value={authorizationNo}
                        onChange={(e) => setAuthorizationNo(e.target.value)}
                        className={`w-full rounded border px-2 py-1 focus:outline-none ${
                          invoiceType === 'SEGURO' || paymentMethod === 'SEGURO_MEDICO'
                            ? 'border-blue-500 bg-blue-50/40'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className={`w-24 shrink-0 font-bold ${
                          hasControlledProduct ? 'text-amber-700' : 'text-slate-700'
                        }`}
                      >
                        # Receta Ctrl:
                      </label>
                      <input
                        type="text"
                        value={controlledRxNo}
                        onChange={(e) => setControlledRxNo(e.target.value)}
                        placeholder={hasControlledProduct ? 'Requerida' : ''}
                        className={`w-full rounded border px-2 py-1 focus:outline-none ${
                          hasControlledProduct && !controlledRxNo
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-24 shrink-0 font-bold text-slate-700">Teléfono</label>
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* VENDEDOR */}
              <fieldset className="rounded-lg border border-slate-300 bg-white px-3 pb-2.5 pt-1">
                <legend className="px-1.5 text-xs font-bold text-slate-800">Vendedor:</legend>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-12 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-center font-bold text-slate-700">
                    1
                  </span>
                  <select
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-900"
                  >
                    <option value="COMPAÑÍA">COMPAÑÍA</option>
                    {branchEmployees.map((emp) => (
                      <option key={emp.id} value={emp.fullName.toUpperCase()}>
                        {emp.fullName.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>
            </div>

            {/* BLOQUE DERECHO: INFORMACIÓN DE LA FACTURA */}
            <fieldset className="rounded-lg border border-slate-300 bg-white px-3 pb-3 pt-1.5 xl:col-span-5">
              <legend className="px-1.5 text-xs font-bold text-slate-800">
                Información de la Factura
              </legend>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">Número:</label>
                  <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-center font-mono font-bold text-blue-800">
                    {previewInvoiceNo}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">Fecha:</label>
                  <div className="grid flex-1 grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={liveDate}
                      className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-center font-semibold text-slate-800"
                    />
                    <input
                      type="text"
                      readOnly
                      value={liveTime}
                      className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-center font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">Tipo:</label>
                  <select
                    value={invoiceType}
                    onChange={(e) => {
                      const val = e.target.value as InvoiceType;
                      setInvoiceType(val);
                      if (val === 'SEGURO') setPaymentMethod('SEGURO_MEDICO');
                    }}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-bold text-slate-900"
                  >
                    <option value="CONTADO">CONTADO</option>
                    <option value="CREDITO">CRÉDITO</option>
                    <option value="SEGURO">SEGURO MÉDICO</option>
                    <option value="DOMICILIO">DOMICILIO</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">Conduce:</label>
                  <input
                    type="text"
                    value={conduceNo}
                    onChange={(e) => setConduceNo(e.target.value)}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-slate-900"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">Orden No:</label>
                  <input
                    type="text"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-slate-900"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">Almacén:</label>
                  <input
                    type="text"
                    readOnly
                    value={activeBranch.name.toUpperCase()}
                    className="flex-1 rounded border border-slate-200 bg-slate-100 px-2 py-1 font-bold text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">NCF Tipo:</label>
                  <select
                    value={ncfType}
                    onChange={(e) => setNcfType(e.target.value as NcfType)}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-bold text-slate-900"
                  >
                    {(Object.keys(NCF_LABELS) as NcfType[]).map((k) => (
                      <option key={k} value={k}>
                        {NCF_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-right font-bold text-slate-700">NCF:</label>
                  <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-center font-mono font-bold text-blue-800">
                    {previewNcf}
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          {/* TABLA CENTRAL DE PRODUCTOS (CON ENTRADA DINÁMICA INLINE + ESCÁNER) */}
          <div className="flex flex-col rounded-lg border border-slate-300 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-[11px] font-bold text-slate-800">
                    <th className="border-r border-slate-200 px-2 py-1.5">Código</th>
                    <th className="border-r border-slate-200 px-2 py-1.5 text-center" title="Exento de ITBIS">
                      E
                    </th>
                    <th className="border-r border-slate-200 px-2.5 py-1.5">Descripción</th>
                    <th className="border-r border-slate-200 px-2 py-1.5 text-right">Ctd</th>
                    <th className="border-r border-slate-200 px-2 py-1.5 text-right">Oferta</th>
                    <th className="border-r border-slate-200 px-2 py-1.5">Und</th>
                    <th className="border-r border-slate-200 px-2.5 py-1.5 text-right">Precio</th>
                    <th className="border-r border-slate-200 px-2.5 py-1.5 text-right">Total</th>
                    <th className="border-r border-slate-200 px-2.5 py-1.5 text-right">Total Neto</th>
                    <th className="border-r border-slate-200 px-2.5 py-1.5 text-right">Itbis</th>
                    <th className="border-r border-slate-200 px-2 py-1.5 text-center">100%</th>
                    <th className="px-1.5 py-1.5 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cart.map((row) => {
                    const p = products.find((x) => x.id === row.productId)!;
                    const isSelected = selectedRowId === row.productId;
                    const gross = row.qty * row.unitPrice;
                    const net = gross * (1 - row.discountPct / 100);
                    const pct =
                      !applyItbisGlobal || row.exempt
                        ? 0
                        : p.taxPct > 0
                        ? p.taxPct
                        : itbisRate;
                    const itbis = net * (pct / 100);

                    return (
                      <tr
                        key={row.productId}
                        onClick={() => setSelectedRowId(row.productId)}
                        className={`cursor-pointer ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="border-r border-slate-200 px-2 py-1.5 font-mono font-bold text-slate-800">
                          {p.barcode.slice(-4)}
                        </td>
                        <td className="border-r border-slate-200 px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.exempt}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.productId === row.productId
                                    ? { ...c, exempt: e.target.checked }
                                    : c
                                )
                              )
                            }
                          />
                        </td>
                        <td className="border-r border-slate-200 px-2.5 py-1.5 font-bold text-blue-900">
                          {p.commercialName.toUpperCase()}
                          {p.requiresPrescription && (
                            <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] text-amber-800">
                              CTRL
                            </span>
                          )}
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1 text-right">
                          <input
                            type="number"
                            min={1}
                            value={row.qty}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.productId === row.productId ? { ...c, qty: val } : c
                                )
                              );
                            }}
                            className="w-14 rounded border border-slate-200 px-1.5 py-0.5 text-right font-bold text-blue-900"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1 text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.bonusQty}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.productId === row.productId ? { ...c, bonusQty: val } : c
                                )
                              );
                            }}
                            className="w-12 rounded border border-slate-200 px-1 py-0.5 text-right"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <select
                            value={row.unit}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.productId === row.productId
                                    ? { ...c, unit: e.target.value as SaleUnit }
                                    : c
                                )
                              )
                            }
                            className="bg-transparent font-semibold text-slate-800 focus:outline-none"
                          >
                            <option value="UNID">UNID</option>
                            <option value="BLIS">BLIS</option>
                            <option value="CAJA">CAJA</option>
                          </select>
                        </td>
                        <td className="border-r border-slate-200 px-1.5 py-1 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={row.unitPrice}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.productId === row.productId ? { ...c, unitPrice: val } : c
                                )
                              );
                            }}
                            className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-right font-bold text-blue-900"
                          />
                        </td>
                        <td className="border-r border-slate-200 bg-blue-800 px-2.5 py-1.5 text-right font-bold text-white">
                          {gross.toFixed(2)}
                        </td>
                        <td className="border-r border-slate-200 px-2.5 py-1.5 text-right font-semibold text-slate-800">
                          {net.toFixed(2)}
                        </td>
                        <td className="border-r border-slate-200 px-2.5 py-1.5 text-right font-bold text-blue-700">
                          {itbis.toFixed(2)}
                        </td>
                        <td className="border-r border-slate-200 px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.coverage100}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.productId === row.productId
                                    ? { ...c, coverage100: e.target.checked }
                                    : c
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCart((prev) => prev.filter((c) => c.productId !== row.productId));
                            }}
                            className="text-rose-500 hover:text-rose-700"
                            title="Borrar [F7]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* FILA DINÁMICA DE INGRESO RÁPIDO (CÓDIGO / ESCÁNER / BÚSQUEDA) */}
                  <tr className="bg-blue-50/30">
                    <td colSpan={12} className="relative p-1.5">
                      <div className="flex items-center gap-2">
                        <Barcode className="h-4 w-4 shrink-0 text-blue-600" />
                        <input
                          ref={inlineCodeRef}
                          type="text"
                          autoFocus
                          value={inlineQuery}
                          onFocus={() => setShowInlineDropdown(true)}
                          onChange={(e) => {
                            setInlineQuery(e.target.value);
                            setShowInlineDropdown(true);
                          }}
                          onKeyDown={handleInlineEnter}
                          placeholder="Escriba código, código de barras o nombre del producto y presione [Enter]..."
                          className="w-full bg-transparent text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>

                      {showInlineDropdown && inlineQuery.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-30 max-h-60 overflow-y-auto rounded-b-lg border border-slate-300 bg-white shadow-xl">
                          {branchProducts.length === 0 ? (
                            <p className="p-3 text-center text-xs text-slate-400">
                              Sin resultados para &quot;{inlineQuery}&quot;
                            </p>
                          ) : (
                            branchProducts.map(({ product, stock, nextLot, otherBranches }) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => {
                                  addToCart(product.id);
                                  setInlineQuery('');
                                  setShowInlineDropdown(false);
                                }}
                                className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50"
                              >
                                <div>
                                  <span className="mr-2 font-mono text-slate-400">{product.barcode}</span>
                                  <span className="font-bold text-slate-900">{product.commercialName}</span>
                                  <span className="ml-2 text-[11px] text-slate-500">
                                    ({product.activeIngredient})
                                  </span>
                                  {nextLot && (
                                    <span className="ml-2 text-[10px] text-emerald-700">
                                      FEFO: {nextLot.lotNumber}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {otherBranches.map((ob) => (
                                    <span key={ob.id} className="text-[10px] text-slate-500">
                                      {ob.name}: <b>{ob.qty}</b>
                                    </span>
                                  ))}
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      stock > 0
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-rose-100 text-rose-700'
                                    }`}
                                  >
                                    Local: {stock}
                                  </span>
                                  <span className="font-bold text-blue-700">
                                    ${product.salePrice.toFixed(2)}
                                  </span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ESPACIO VISUAL LIMPIO DEL GRID + BARRA INFERIOR DEL PRODUCTO */}
            <div className="min-h-[80px] border-t border-slate-100 bg-white" />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-slate-50 px-3 py-1.5 text-xs">
              {inspectedItem ? (
                <>
                  <span className="font-bold text-slate-800">
                    {inspectedItem.product.commercialName.toUpperCase()} ·{' '}
                    {inspectedItem.product.presentation}
                  </span>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="font-bold text-slate-900">
                      Existencia: {inspectedItem.stock}
                    </span>
                    <span className="text-slate-600">
                      {inspectedItem.nextLot
                        ? `FEFO: ${inspectedItem.nextLot.lotNumber} (${inspectedItem.nextLot.expiryDate})`
                        : 'Sin lote'}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {inspectedItem.product.laboratory}
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      {inspectedItem.otherBranches.map((ob) => (
                        <span key={ob.id} className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">
                          {ob.name}: {ob.qty}
                          {inspectedItem.stock < 5 && ob.qty > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                requestTransfer(
                                  ob.id,
                                  activeBranchId,
                                  inspectedItem.product.id,
                                  Math.min(10, ob.qty)
                                );
                                setInfoMsg(
                                  `Traslado solicitado desde ${ob.name} para ${inspectedItem.product.commercialName}.`
                                );
                              }}
                              className="ml-1 inline-flex items-center text-blue-700 hover:text-blue-900"
                              title="Solicitar traslado"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-slate-400">
                  Seleccione o agregue un producto para ver su existencia en las 3 farmacias y lote FEFO
                </span>
              )}
            </div>
          </div>

          {/* BARRA DE ATAJOS EXACTA DE LA IMAGEN */}
          <div className="flex flex-wrap items-center justify-around gap-2 py-0.5 text-xs font-bold text-slate-800">
            <button type="button" onClick={() => setShowLookupModal(true)} className="hover:text-blue-700">
              [F3] - Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedRowId !== null) {
                  setCart((prev) => prev.filter((c) => c.productId !== selectedRowId));
                  setSelectedRowId(null);
                }
              }}
              className="hover:text-rose-700"
            >
              [F7] - Borrar
            </button>
            <span>[Enter] - Próxima Línea</span>
            <button type="button" onClick={() => inlineCodeRef.current?.focus()} className="hover:text-blue-700">
              [F12] - Seleccionar Área Productos
            </button>
          </div>

          {/* SECCIÓN INFERIOR: IZQUIERDA (CONTADOR, NOTA, FACTURADOR) | DERECHA (MONEDA, PAGO Y TOTALES) */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            {/* INFERIOR IZQUIERDA */}
            <div className="flex flex-col gap-2 xl:col-span-6">
              <div className="flex items-center gap-3">
                <div className="w-24 rounded border border-slate-300 bg-white py-1 text-center text-sm font-extrabold text-blue-800">
                  {totals.totalUnits}
                </div>
                {/* Selector rápido de método de pago integrado */}
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ['EFECTIVO', 'Efectivo', Banknote],
                      ['TARJETA', 'Tarjeta', CreditCard],
                      ['TRANSFERENCIA', 'Transf.', Building],
                      ['SEGURO_MEDICO', 'Seguro', ShieldCheck],
                    ] as const
                  ).map(([m, label, Icon]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold transition ${
                        paymentMethod === m
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'EFECTIVO' && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">Recibido:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={totals.total.toFixed(2)}
                      className="w-24 rounded border border-slate-300 px-2 py-0.5 text-right font-bold"
                    />
                    {[20, 50, 100, 500].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmountReceived(String(v))}
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold hover:bg-blue-50"
                      >
                        ${v}
                      </button>
                    ))}
                  </div>
                  <span className="font-extrabold text-emerald-700">
                    Devuelta: {fmtCurr(changeDue)}
                  </span>
                </div>
              )}

              <fieldset className="rounded-lg border border-slate-300 bg-white px-3 pb-2 pt-1">
                <legend className="px-1.5 text-xs font-bold text-slate-800">Nota</legend>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Observaciones, póliza ARS o instrucciones..."
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </fieldset>

              <fieldset className="rounded-lg border border-slate-300 bg-white px-3 pb-2 pt-1">
                <legend className="px-1.5 text-xs font-bold text-slate-800">
                  Información del Facturador
                </legend>
                {showCashierSelect ? (
                  <select
                    value={cashierName}
                    onChange={(e) => {
                      setCashierName(e.target.value);
                      setShowCashierSelect(false);
                    }}
                    onBlur={() => setShowCashierSelect(false)}
                    autoFocus
                    className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm font-extrabold text-blue-900"
                  >
                    {branchEmployees.map((emp) => (
                      <option key={emp.id} value={emp.fullName.toUpperCase()}>
                        {emp.fullName.toUpperCase()}
                      </option>
                    ))}
                    <option value="DUEÑO (SUPERADMIN)">DUEÑO (SUPERADMIN)</option>
                  </select>
                ) : (
                  <p
                    onClick={() => setShowCashierSelect(true)}
                    title="Clic para cambiar facturador"
                    className="cursor-pointer text-sm font-extrabold uppercase text-blue-900 hover:underline"
                  >
                    {cashierName}
                  </p>
                )}
              </fieldset>
            </div>

            {/* INFERIOR DERECHA: MONEDA + SUBTOTAL / DESC / ITBIS / COBERTURA / TOTAL */}
            <div className="flex items-stretch gap-2 xl:col-span-6">
              {/* Botones Dólar / Euro / USD */}
              <div className="flex flex-col justify-end gap-1.5 pb-1">
                {(Object.keys(CURRENCY_RATES) as Array<keyof typeof CURRENCY_RATES>).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrencyView(c)}
                    className={`rounded border px-2.5 py-1.5 text-xs font-bold shadow-sm transition ${
                      currencyView === c
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {CURRENCY_RATES[c].label}
                  </button>
                ))}
              </div>

              {/* Caja de Totales */}
              <div className="flex-1 space-y-1.5 rounded-lg border border-slate-300 bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="w-28 text-right font-bold text-slate-800">SubTotal:</span>
                  <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-right font-bold text-slate-900">
                    {fmtCurr(totals.subtotal)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="w-28 text-right font-bold text-slate-800">(F9) Desc.:</span>
                  <div className="flex flex-1 gap-1.5">
                    <input
                      ref={discountInputRef}
                      type="number"
                      min={0}
                      max={100}
                      value={globalDiscountPct}
                      onChange={(e) =>
                        setGlobalDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right font-bold"
                    />
                    <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-right font-bold text-slate-900">
                      {fmtCurr(totals.totalDiscount)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex w-28 items-center justify-end gap-1.5 font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={applyItbisGlobal}
                      onChange={(e) => setApplyItbisGlobal(e.target.checked)}
                    />
                    Itbis:
                  </label>
                  <div className="flex flex-1 gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={applyItbisGlobal ? itbisRate : 0}
                      className="w-20 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-right font-bold text-slate-700"
                    />
                    <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-right font-bold text-slate-900">
                      {fmtCurr(totals.tax)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="w-28 text-right font-bold text-slate-800">Cobertura:</span>
                  <div className="flex flex-1 gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={coveragePct}
                      onChange={(e) =>
                        setCoveragePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right font-bold"
                    />
                    <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-right font-bold text-slate-900">
                      {fmtCurr(totals.coverageAmount)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="w-28 text-right text-xs font-extrabold text-blue-900">
                    iFISCAL TOTAL:
                  </span>
                  <div className="flex-1 rounded bg-blue-800 px-3 py-1.5 text-right text-lg font-extrabold text-amber-300">
                    {fmtCurr(totals.total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL LATERAL DERECHO DE ACCIONES (ESTRUCTURA EXACTA DE LA IMAGEN) */}
        <div className="flex w-full shrink-0 flex-col gap-1.5 lg:w-44">
          <button
            type="button"
            onClick={resetInvoice}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <FilePlus2 className="h-4 w-4 text-amber-600" />
            Nueva
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-rose-50 hover:text-rose-700"
          >
            <Ban className="h-4 w-4 text-rose-500" />
            Anular
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Search className="h-4 w-4 text-emerald-600" />
            Buscar
          </button>

          <button
            type="button"
            onClick={() => setShowQuotesModal(true)}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-left text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 shrink-0 text-blue-600" />
            <span>Traer de Cotización</span>
          </button>

          <button
            type="button"
            onClick={handleHoldInvoice}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-left text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <PauseCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Poner En Espera</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHeldModal(true)}
            className="flex items-center justify-between rounded border border-slate-300 bg-white px-2.5 py-1.5 text-left text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 shrink-0 text-blue-600" />
              <span>Traer de Espera</span>
            </span>
            {branchHeldCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                {branchHeldCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowLookupModal(true)}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-left text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <PackageSearch className="h-4 w-4 shrink-0 text-indigo-600" />
            <span>Consultar Producto</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <History className="h-4 w-4 text-emerald-600" />
            Histórico
          </button>

          <button
            type="button"
            onClick={() => setShowCashierSelect((v) => !v)}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <UserCheck className="h-4 w-4 text-slate-700" />
            Facturador
          </button>

          <button
            type="button"
            onClick={() => setInvoiceType('DOMICILIO')}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Truck className="h-4 w-4 text-emerald-600" />
            Q/P Domicilio
          </button>

          <button
            type="button"
            onClick={() => {
              setInvoiceType('SEGURO');
              setPaymentMethod('SEGURO_MEDICO');
              if (coveragePct === 0) setCoveragePct(80);
            }}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            Q/P Seguro
          </button>

          <button
            type="button"
            onClick={() => setShowDeliveryModal(true)}
            className="flex items-center justify-between rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <span>Domicilio Pend</span>
            {pendingDeliveriesCount > 0 && (
              <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">
                {pendingDeliveriesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowHeldModal(true)}
            className="flex items-center justify-between rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <span>Q/P Pendiente</span>
            <Clock className="h-3.5 w-3.5 text-slate-500" />
          </button>

          <div className="mt-1 space-y-1 border-t border-slate-300 pt-2 text-xs font-bold text-slate-700">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={autoAssignNumber}
                onChange={(e) => setAutoAssignNumber(e.target.checked)}
              />
              Número
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
              />
              Imprimir
            </label>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={cart.length === 0}
            className="mt-1 flex items-center justify-center gap-1.5 rounded border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            <Check className="h-4 w-4" />
            Guardar
          </button>

          <button
            type="button"
            onClick={resetInvoice}
            className="flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <XCircle className="h-4 w-4 text-blue-600" />
            Cerrar
          </button>
        </div>
      </div>

      {/* BARRA DE ESTADO INFERIOR (COMO EN LA IMAGEN) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-b-xl border-t border-slate-300 bg-slate-200 px-4 py-1.5 text-[11px] font-bold text-slate-700">
        <div className="flex flex-wrap items-center gap-6">
          <span>👤 {cashierName.toUpperCase()}</span>
          <span>
            📅 {liveDate} {liveTime}
          </span>
          <span className={cart.length > 0 ? 'text-amber-700' : 'text-slate-600'}>
            🏷️ {cart.length > 0 ? 'SIN CONFIRMAR' : 'LISTO PARA FACTURAR'}
          </span>
          <span className="text-blue-800">⚡ AUTOMÁTICO (FEFO + NCF)</span>
        </div>
        <span className="text-slate-500">[F2] Nueva · [F4] Espera · [F8] Guardar · [F9] Desc.</span>
      </div>

      {/* MODALES */}
      <ProductLookupModal
        open={showLookupModal}
        onClose={() => setShowLookupModal(false)}
        activeBranchId={activeBranchId}
        products={products}
        lots={lots}
        onAddProduct={addToCart}
        onRequestTransfer={requestTransfer}
      />

      <InvoiceHistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sales={sales}
        onReprint={(sale) => setLastSale(sale)}
        onVoidSale={voidSale}
      />

      <HeldInvoicesModal
        open={showHeldModal}
        onClose={() => setShowHeldModal(false)}
        heldInvoices={heldInvoices.filter((h) => h.branchId === activeBranchId)}
        onResume={handleResumeHeld}
        onDiscard={removeHeldInvoice}
      />

      <QuotationsModal
        open={showQuotesModal}
        onClose={() => setShowQuotesModal(false)}
        quotations={quotations}
        onLoadQuotation={handleLoadQuotation}
      />

      <DeliveryQueueModal
        open={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        sales={sales}
        onUpdateStatus={updateDeliveryStatus}
      />

      <NewClientModal
        open={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        onCreate={(data) => {
          const created = addClient(data);
          handleSelectClient(created.id);
          setInfoMsg(`Cliente ${created.name} registrado y seleccionado.`);
        }}
      />

      <ReceiptModal sale={lastSale} onClose={() => setLastSale(null)} />
    </div>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Printer,
  RotateCcw,
  Truck,
  CheckCircle2,
  Ban,
  Clock,
  FileText,
  ArrowRightLeft,
  UserPlus,
  Package,
} from 'lucide-react';
import { BRANCHES } from '@/data/mockData';
import {
  BranchCode,
  Client,
  HeldInvoice,
  Lot,
  Product,
  Quotation,
  SaleRecord,
} from '@/types/pharmacy';

/* 1. CONSULTAR PRODUCTO (STOCK 3 SUCURSALES + LOTES FEFO + TRASLADO) */
export function ProductLookupModal({
  open,
  onClose,
  activeBranchId,
  products,
  lots,
  onAddProduct,
  onRequestTransfer,
}: {
  open: boolean;
  onClose: () => void;
  activeBranchId: BranchCode;
  products: Product[];
  lots: Lot[];
  onAddProduct: (productId: number) => void;
  onRequestTransfer: (fromBranch: BranchCode, toBranch: BranchCode, productId: number, qty: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [transferNotice, setTransferNotice] = useState<string | null>(null);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      !q ||
      p.barcode.includes(q) ||
      p.commercialName.toLowerCase().includes(q) ||
      p.activeIngredient.toLowerCase().includes(q) ||
      p.laboratory.toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Consulta Integrada de Productos (3 Farmacias &amp; Lotes FEFO)
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre comercial, principio activo, laboratorio o código de barras..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          {transferNotice && (
            <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {transferNotice}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filtered.map((p) => {
              const branchStocks = BRANCHES.map((b) => {
                const bLots = lots
                  .filter((l) => l.branchId === b.id && l.productId === p.id && l.availableQty > 0)
                  .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
                const qty = bLots.reduce((s, l) => s + l.availableQty, 0);
                return { branch: b, qty, nextLot: bLots[0] };
              });
              const activeStock = branchStocks.find((bs) => bs.branch.id === activeBranchId)?.qty ?? 0;

              return (
                <div key={p.id} className="rounded-xl border border-slate-200 p-4 hover:border-blue-300">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">#{p.barcode}</span>
                        <h4 className="font-bold text-slate-900">{p.commercialName}</h4>
                        {p.requiresPrescription && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            RECETA CTRL
                          </span>
                        )}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {p.taxPct > 0 ? `ITBIS ${p.taxPct}%` : 'EXENTO'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {p.activeIngredient} · {p.presentation} · Lab: {p.laboratory}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-blue-600">${p.salePrice.toFixed(2)}</span>
                      <button
                        disabled={activeStock === 0}
                        onClick={() => {
                          onAddProduct(p.id);
                          onClose();
                        }}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                      >
                        + Facturar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {branchStocks.map(({ branch, qty, nextLot }) => {
                      const isCurrent = branch.id === activeBranchId;
                      return (
                        <div
                          key={branch.id}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                            isCurrent ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-slate-800">
                              {branch.name} {isCurrent && '(Actual)'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {nextLot ? `FEFO: ${nextLot.lotNumber} · ${nextLot.expiryDate}` : 'Sin stock'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 font-bold ${
                                qty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {qty}
                            </span>
                            {!isCurrent && qty > 0 && activeStock < 5 && (
                              <button
                                title="Solicitar traslado de 10 unidades a esta sucursal"
                                onClick={() => {
                                  const reqQty = Math.min(10, qty);
                                  onRequestTransfer(branch.id, activeBranchId, p.id, reqQty);
                                  setTransferNotice(
                                    `Traslado solicitado: ${reqQty}x ${p.commercialName} desde ${branch.name}.`
                                  );
                                }}
                                className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-700"
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* 2. HISTÓRICO DE FACTURAS, BÚSQUEDA Y ANULACIÓN */
export function InvoiceHistoryModal({
  open,
  onClose,
  sales,
  onReprint,
  onVoidSale,
}: {
  open: boolean;
  onClose: () => void;
  sales: SaleRecord[];
  onReprint: (sale: SaleRecord) => void;
  onVoidSale: (saleId: string, reason: string) => { ok: boolean; error?: string };
}) {
  const [search, setSearch] = useState('');
  const [voidTarget, setVoidTarget] = useState<SaleRecord | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter(
      (s) =>
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.ncf ?? '').toLowerCase().includes(q) ||
        (s.clientName ?? '').toLowerCase().includes(q) ||
        s.cashierName.toLowerCase().includes(q)
    );
  }, [sales, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Histórico de Facturas, Reimpresión y Anulación
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por # Factura, NCF, Cliente o Facturador..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {voidTarget && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-900">
              ¿Confirmar anulación de {voidTarget.invoiceNumber}? (Se restaurará el stock a los lotes FEFO)
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Motivo de anulación (ej. Error en cliente / devolución)..."
                className="flex-1 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs"
              />
              <button
                onClick={() => {
                  onVoidSale(voidTarget.id, voidReason);
                  setVoidTarget(null);
                  setVoidReason('');
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Confirmar Anulación
              </button>
              <button
                onClick={() => setVoidTarget(null)}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-2">Factura</th>
                <th className="pb-2">NCF</th>
                <th className="pb-2">Fecha</th>
                <th className="pb-2">Sucursal</th>
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Pago</th>
                <th className="pb-2 text-right">Total</th>
                <th className="pb-2 text-center">Estado</th>
                <th className="pb-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const isVoid = s.status === 'ANULADA';
                return (
                  <tr key={s.id} className={isVoid ? 'bg-rose-50/40 opacity-75' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 font-mono font-bold text-slate-900">{s.invoiceNumber}</td>
                    <td className="py-2.5 font-mono text-slate-600">{s.ncf || '—'}</td>
                    <td className="py-2.5 text-slate-600">{s.date}</td>
                    <td className="py-2.5 font-semibold text-slate-700">{s.branchId}</td>
                    <td className="py-2.5 text-slate-800">{s.clientName || 'VENTAS AL CONTADO'}</td>
                    <td className="py-2.5 text-slate-600">{s.paymentMethod}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">${s.totalSale.toFixed(2)}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isVoid ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isVoid ? 'ANULADA' : 'CONFIRMADA'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => {
                            onReprint(s);
                            onClose();
                          }}
                          className="rounded bg-slate-100 p-1.5 text-slate-700 hover:bg-blue-100 hover:text-blue-700"
                          title="Reimprimir"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {!isVoid && (
                          <button
                            onClick={() => setVoidTarget(s)}
                            className="rounded bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                            title="Anular Factura"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* 3. TICKETS EN ESPERA */
export function HeldInvoicesModal({
  open,
  onClose,
  heldInvoices,
  onResume,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  heldInvoices: HeldInvoice[];
  onResume: (held: HeldInvoice) => void;
  onDiscard: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Facturas en Espera</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {heldInvoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay facturas en espera actualmente.
            </p>
          ) : (
            <div className="space-y-3">
              {heldInvoices.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-bold text-slate-900">{h.clientName}</p>
                    <p className="text-xs text-slate-500">
                      Guardada a las {h.savedAt} · {h.items.length} línea(s) · {h.invoiceType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onResume(h);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Recuperar
                    </button>
                    <button
                      onClick={() => onDiscard(h.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* 4. COTIZACIONES */
export function QuotationsModal({
  open,
  onClose,
  quotations,
  onLoadQuotation,
}: {
  open: boolean;
  onClose: () => void;
  quotations: Quotation[];
  onLoadQuotation: (quote: Quotation) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Traer de Cotización</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {quotations.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No hay cotizaciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {quotations.map((q) => (
                <div key={q.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600">{q.quoteNumber}</span>
                      <span className="font-bold text-slate-900">{q.clientName}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {q.date} · {q.items.length} producto(s) · {q.note || 'Sin nota'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">${q.estimatedTotal.toFixed(2)}</span>
                    <button
                      onClick={() => {
                        onLoadQuotation(q);
                        onClose();
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                      Cargar a Factura
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* 5. DOMICILIO PENDIENTE */
export function DeliveryQueueModal({
  open,
  onClose,
  sales,
  onUpdateStatus,
}: {
  open: boolean;
  onClose: () => void;
  sales: SaleRecord[];
  onUpdateStatus: (saleId: string, status: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO') => void;
}) {
  if (!open) return null;
  const deliveries = sales.filter((s) => s.isDelivery && s.status !== 'ANULADA');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Cola de Domicilios / Delivery</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-6">
          {deliveries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay pedidos a domicilio registrados.
            </p>
          ) : (
            <div className="space-y-3">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-bold text-slate-900">
                      {d.invoiceNumber} — {d.clientName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Tel: {d.clientPhone || 'N/A'} · Dir: {d.deliveryAddress || 'Sin dirección'} · ${d.totalSale.toFixed(2)}
                    </p>
                  </div>
                  <select
                    value={d.deliveryStatus || 'PENDIENTE'}
                    onChange={(e) =>
                      onUpdateStatus(d.id, e.target.value as 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO')
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  >
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="EN_RUTA">EN RUTA</option>
                    <option value="ENTREGADO">ENTREGADO</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* 6. NUEVO CLIENTE RÁPIDO */
export function NewClientModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (client: Omit<Client, 'id' | 'code'>) => void;
}) {
  const [name, setName] = useState('');
  const [rncOrCedula, setRncOrCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [arsProvider, setArsProvider] = useState('');
  const [arsPolicyNo, setArsPolicyNo] = useState('');
  const [defaultDiscountPct, setDefaultDiscountPct] = useState(0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Cliente</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate({
              name: name.trim().toUpperCase(),
              rncOrCedula: rncOrCedula.trim(),
              phone: phone.trim(),
              address: address.trim(),
              defaultDiscountPct,
              arsProvider: arsProvider.trim() || undefined,
              arsPolicyNo: arsPolicyNo.trim() || undefined,
            });
            setName('');
            setRncOrCedula('');
            setPhone('');
            setAddress('');
            setArsProvider('');
            setArsPolicyNo('');
            setDefaultDiscountPct(0);
            onClose();
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Nombre Completo / Razón Social *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">RNC / Cédula</label>
              <input
                value={rncOrCedula}
                onChange={(e) => setRncOrCedula(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Teléfono</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Dirección</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">ARS / Seguro</label>
              <input
                value={arsProvider}
                onChange={(e) => setArsProvider(e.target.value)}
                placeholder="Ej. ARS Humano"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">No. Póliza / NSS</label>
              <input
                value={arsPolicyNo}
                onChange={(e) => setArsPolicyNo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Desc. Fijo %</label>
              <input
                type="number"
                min={0}
                max={50}
                value={defaultDiscountPct}
                onChange={(e) => setDefaultDiscountPct(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
            >
              Guardar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* 7. MODAL DE TICKET / FACTURA FISCAL IMPRIMIBLE */
export function ReceiptModal({
  sale,
  onClose,
}: {
  sale: SaleRecord | null;
  onClose: () => void;
}) {
  if (!sale) return null;
  const branch = BRANCHES.find((b) => b.id === sale.branchId) ?? BRANCHES[0];
  const coverage = sale.coverageAmount ?? 0;
  const patientPaid = +(sale.totalSale - coverage).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="no-print mb-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            Factura {sale.invoiceNumber} Emitida
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800">
          <div className="border-b border-dashed border-slate-300 pb-2 text-center">
            <p className="text-sm font-bold">{branch.name.toUpperCase()}</p>
            <p>RNC: {branch.rnc}</p>
            <p>{branch.address}</p>
            <p>Tel: {branch.phone}</p>
          </div>

          <div className="my-2 space-y-0.5 border-b border-dashed border-slate-300 pb-2">
            <div className="flex justify-between">
              <span>Factura: {sale.invoiceNumber}</span>
              <span>{sale.date}</span>
            </div>
            {sale.ncf && (
              <div className="flex justify-between font-bold">
                <span>NCF ({sale.ncfType}):</span>
                <span>{sale.ncf}</span>
              </div>
            )}
            <p>Cliente: {sale.clientName || 'VENTAS AL CONTADO'}</p>
            {sale.clientRnc && <p>RNC/Cédula: {sale.clientRnc}</p>}
            {sale.authorizationNo && <p>Autorización ARS: {sale.authorizationNo}</p>}
            {sale.controlledRxNo && <p>Receta Ctrl: {sale.controlledRxNo}</p>}
            <p>Facturador: {sale.cashierName}</p>
          </div>

          <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
            {sale.lines.map((l, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-semibold">
                  <span>
                    {l.qty} {l.unit || 'UNID'} x {l.productName}
                  </span>
                  <span>${l.lineTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>
                    Lote: {l.lotNumber} · ${l.unitPrice.toFixed(2)} c/u
                    {l.bonusQty ? ` (+${l.bonusQty} oferta)` : ''}
                  </span>
                  <span>{l.tax > 0 ? `ITBIS $${l.tax.toFixed(2)}` : 'EXENTO'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-0.5">
            <div className="flex justify-between">
              <span>SubTotal:</span>
              <span>${sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Descuento:</span>
                <span>-${sale.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>ITBIS:</span>
              <span>${sale.taxTotal.toFixed(2)}</span>
            </div>
            {coverage > 0 && (
              <div className="flex justify-between text-blue-700">
                <span>Cobertura ARS ({sale.coveragePct}%):</span>
                <span>-${coverage.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 text-sm font-bold">
              <span>TOTAL A PAGAR:</span>
              <span>${patientPaid.toFixed(2)}</span>
            </div>
            {sale.amountReceived !== undefined && (
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Recibido ({sale.paymentMethod}):</span>
                <span>
                  ${sale.amountReceived.toFixed(2)} · Cambio: ${(sale.changeDue ?? 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {sale.note && (
            <p className="mt-2 border-t border-dashed border-slate-300 pt-1 text-[10px] text-slate-500">
              Nota: {sale.note}
            </p>
          )}
          <p className="mt-3 text-center text-[10px] text-slate-500">
            ¡Gracias por su preferencia! Despacho automático FEFO.
          </p>
        </div>
      </div>
    </div>
  );
}

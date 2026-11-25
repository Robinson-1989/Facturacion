'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, PackageCheck } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { BRANCHES } from '@/data/mockData';
import { BranchCode } from '@/types/pharmacy';

export default function InventoryModule() {
  const { globalBranch, products, lots, transfers, requestTransfer, completeTransfer } = useApp();
  const [fromBranch, setFromBranch] = useState<BranchCode>('SUC-01');
  const [toBranch, setToBranch] = useState<BranchCode>('SUC-02');
  const [selectedProdId, setSelectedProdId] = useState<number>(1);
  const [transferQty, setTransferQty] = useState<number>(5);

  const visibleLots = useMemo(() => {
    const today = new Date('2026-11-15').getTime();
    return lots
      .filter((l) => (globalBranch === 'ALL' || l.branchId === globalBranch) && l.availableQty > 0)
      .map((l) => {
        const prod = products.find((p) => p.id === l.productId)!;
        const branch = BRANCHES.find((b) => b.id === l.branchId)!;
        const daysLeft = Math.ceil((new Date(l.expiryDate).getTime() - today) / 86400000);
        return { ...l, prod, branchName: branch.name, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [lots, products, globalBranch]);

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromBranch === toBranch) return;
    requestTransfer(fromBranch, toBranch, selectedProdId, transferQty);
  };

  return (
    <div className="space-y-6">
      {/* CONTROL DE LOTES Y VENCIMIENTOS (FEFO) */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Control de Lotes y Alertas de Vencimiento (FEFO)
            </h2>
            <p className="text-xs text-slate-500">
              Ordenados automáticamente del lote más próximo a vencer al más lejano
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Sucursal</th>
                <th className="px-4 py-3">Medicamento</th>
                <th className="px-4 py-3">N° Lote</th>
                <th className="px-4 py-3">Pasillo</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Vencimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLots.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{l.branchName}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{l.prod.commercialName}</div>
                    <div className="text-xs text-slate-500">{l.prod.activeIngredient}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{l.lotNumber}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{l.aisle}</td>
                  <td className="px-4 py-3 font-bold">{l.availableQty}</td>
                  <td className="px-4 py-3">
                    {l.daysLeft <= 45 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {l.expiryDate} ({l.daysLeft}d)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">{l.expiryDate}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* TRASLADOS ENTRE SUCURSALES */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleCreateTransfer}
          className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-5"
        >
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ArrowRightLeft className="h-4 w-4 text-blue-600" />
            Solicitar Traslado entre Sucursales
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Origen</label>
              <select
                value={fromBranch}
                onChange={(e) => setFromBranch(e.target.value as BranchCode)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Destino</label>
              <select
                value={toBranch}
                onChange={(e) => setToBranch(e.target.value as BranchCode)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Producto</label>
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.commercialName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Cantidad</label>
              <input
                type="number"
                min={1}
                value={transferQty}
                onChange={(e) => setTransferQty(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={fromBranch === toBranch}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            Crear Solicitud de Traslado
          </button>
        </form>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-7">
          <h3 className="mb-3 text-base font-bold text-slate-900">
            Historial de Traslados
          </h3>
          <div className="space-y-2.5">
            {transfers.map((tr) => (
              <div
                key={tr.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {tr.productName} ({tr.qty} uds)
                  </p>
                  <p className="text-xs text-slate-500">
                    {tr.fromBranchId} → {tr.toBranchId} · Solicitado por {tr.requestedBy}
                  </p>
                </div>
                {tr.status === 'SOLICITADO' ? (
                  <button
                    onClick={() => completeTransfer(tr.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <PackageCheck className="h-3.5 w-3.5" />
                    Aprobar y Mover Stock
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completado
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Search,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { BRANCHES } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { BranchCode, DateFilterMode } from '@/types/pharmacy';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'USD' }).format(val);

export default function ExecutiveDashboard() {
  const { globalBranch, products, lots, sales, payrolls, requestTransfer } = useApp();

  const [dateMode, setDateMode] = useState<DateFilterMode>('MONTH');
  const [specificDay, setSpecificDay] = useState('2026-11-15');
  const [rangeStart, setRangeStart] = useState('2026-11-13');
  const [rangeEnd, setRangeEnd] = useState('2026-11-15');
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [selectedYear, setSelectedYear] = useState('2026');

  const [searchQuery, setSearchQuery] = useState('');
  const [transferNotice, setTransferNotice] = useState<string | null>(null);

  const matchDate = (dateStr: string) => {
    if (dateMode === 'DAY') return dateStr === specificDay;
    if (dateMode === 'RANGE') return dateStr >= rangeStart && dateStr <= rangeEnd;
    if (dateMode === 'MONTH') return dateStr.startsWith(selectedMonth);
    if (dateMode === 'YEAR') return dateStr.startsWith(selectedYear);
    return true;
  };

  const filteredSales = useMemo(() => {
    return sales.filter(
      (s) =>
        s.status !== 'ANULADA' &&
        (globalBranch === 'ALL' || s.branchId === globalBranch) &&
        matchDate(s.date)
    );
  }, [sales, globalBranch, dateMode, specificDay, rangeStart, rangeEnd, selectedMonth, selectedYear]);

  const filteredPaidPayrolls = useMemo(() => {
    return payrolls.filter(
      (p) =>
        p.status === 'PAGADA' &&
        (globalBranch === 'ALL' || p.branchId === globalBranch) &&
        matchDate(p.paymentDate)
    );
  }, [payrolls, globalBranch, dateMode, specificDay, rangeStart, rangeEnd, selectedMonth, selectedYear]);

  const financialKPIs = useMemo(() => {
    const grossSales = filteredSales.reduce((acc, s) => acc + s.totalSale, 0);
    const cogs = filteredSales.reduce((acc, s) => acc + s.totalCogs, 0);
    const payroll = filteredPaidPayrolls.reduce((acc, p) => acc + p.netPay, 0);
    const netProfit = grossSales - cogs - payroll;
    const margin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;
    return { grossSales, cogs, payroll, netProfit, margin };
  }, [filteredSales, filteredPaidPayrolls]);

  // Gráfico 1: Comparativa Ventas vs Ganancia Neta por Sucursal
  const branchComparisonData = useMemo(() => {
    return BRANCHES.filter(
      (b) => globalBranch === 'ALL' || b.id === globalBranch
    ).map((branch) => {
      const bSales = filteredSales.filter((s) => s.branchId === branch.id);
      const bPay = filteredPaidPayrolls.filter((p) => p.branchId === branch.id);
      const ventas = +bSales.reduce((acc, s) => acc + s.totalSale, 0).toFixed(2);
      const cogs = bSales.reduce((acc, s) => acc + s.totalCogs, 0);
      const nomina = bPay.reduce((acc, p) => acc + p.netPay, 0);
      const gananciaNeta = +(ventas - cogs - nomina).toFixed(2);
      return { name: branch.name, Ventas: ventas, GananciaNeta: gananciaNeta };
    });
  }, [filteredSales, filteredPaidPayrolls, globalBranch]);

  // Gráfico 2: Ranking de Productos por Sucursal
  const productRankingData = useMemo(() => {
    const map = new Map<
      number,
      { productName: string; 'SUC-01': number; 'SUC-02': number; 'SUC-03': number }
    >();
    filteredSales.forEach((sale) => {
      sale.lines.forEach((line) => {
        if (!map.has(line.productId)) {
          map.set(line.productId, {
            productName: line.productName,
            'SUC-01': 0,
            'SUC-02': 0,
            'SUC-03': 0,
          });
        }
        const entry = map.get(line.productId)!;
        entry[sale.branchId] += line.qty;
      });
    });
    return Array.from(map.values()).slice(0, 6);
  }, [filteredSales]);

  // Gráfico 3: Evolución Temporal Superpuesta
  const timelineData = useMemo(() => {
    const dates = Array.from(new Set(filteredSales.map((s) => s.date))).sort();
    return dates.map((date) => {
      const row: Record<string, string | number> = { date };
      BRANCHES.forEach((b) => {
        if (globalBranch === 'ALL' || globalBranch === b.id) {
          const dayTotal = filteredSales
            .filter((s) => s.date === date && s.branchId === b.id)
            .reduce((sum, s) => sum + s.totalSale, 0);
          row[b.name] = +dayTotal.toFixed(2);
        }
      });
      return row;
    });
  }, [filteredSales, globalBranch]);

  // Buscador Global de Disponibilidad
  const availabilityResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchedProducts = q
      ? products.filter(
          (p) =>
            p.commercialName.toLowerCase().includes(q) ||
            p.activeIngredient.toLowerCase().includes(q) ||
            p.barcode.includes(q)
        )
      : products;

    const today = new Date('2026-11-15').getTime();

    return matchedProducts.map((prod) => {
      const byBranch: Record<
        BranchCode,
        { stock: number; aisle: string; daysToExpire: number | null }
      > = {
        'SUC-01': { stock: 0, aisle: '—', daysToExpire: null },
        'SUC-02': { stock: 0, aisle: '—', daysToExpire: null },
        'SUC-03': { stock: 0, aisle: '—', daysToExpire: null },
      };

      BRANCHES.forEach((b) => {
        const bLots = lots
          .filter((l) => l.branchId === b.id && l.productId === prod.id && l.availableQty > 0)
          .sort((a, bLot) => a.expiryDate.localeCompare(bLot.expiryDate));
        const stock = bLots.reduce((sum, l) => sum + l.availableQty, 0);
        const nearest = bLots[0];
        const daysToExpire = nearest
          ? Math.ceil((new Date(nearest.expiryDate).getTime() - today) / 86400000)
          : null;
        byBranch[b.id] = {
          stock,
          aisle: nearest ? nearest.aisle : 'Sin stock',
          daysToExpire,
        };
      });

      return { prod, byBranch };
    });
  }, [products, lots, searchQuery]);

  const handleQuickTransfer = (
    productId: number,
    productName: string,
    fromId: BranchCode,
    toId: BranchCode
  ) => {
    requestTransfer(fromId, toId, productId, 10);
    setTransferNotice(
      `Traslado solicitado: 10 uds de "${productName}" (${fromId} → ${toId}).`
    );
    setTimeout(() => setTransferNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* FILTROS DINÁMICOS DE FECHA */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span>Período financiero:</span>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          {(
            [
              ['DAY', 'Día'],
              ['RANGE', 'Rango'],
              ['MONTH', 'Mes'],
              ['YEAR', 'Año'],
            ] as [DateFilterMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setDateMode(mode)}
              className={`rounded-md px-3 py-1.5 transition ${
                dateMode === mode
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {dateMode === 'DAY' && (
          <input
            type="date"
            value={specificDay}
            onChange={(e) => setSpecificDay(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        )}
        {dateMode === 'RANGE' && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
            <span>a</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
          </div>
        )}
        {dateMode === 'MONTH' && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        )}
        {dateMode === 'YEAR' && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        )}
      </section>

      {/* TARJETAS KPI FINANCIERAS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Ventas Brutas</span>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(financialKPIs.grossSales)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Costo Mercancía (COGS)</span>
            <Package className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(financialKPIs.cogs)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Nómina Pagada (Gasto Op.)</span>
            <Users className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(financialKPIs.payroll)}
          </p>
        </div>

        <div className="rounded-xl bg-emerald-50 p-5 shadow-sm ring-1 ring-emerald-200">
          <div className="flex items-center justify-between text-sm font-medium text-emerald-800">
            <span>Ganancia Neta ({financialKPIs.margin.toFixed(1)}%)</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {formatCurrency(financialKPIs.netProfit)}
          </p>
        </div>
      </section>

      {/* BUSCADOR GLOBAL DE DISPONIBILIDAD */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Buscador Global de Disponibilidad Multi-Sucursal
            </h2>
            <p className="text-xs text-slate-500">
              Stock en tiempo real en las 3 farmacias, ubicación/pasillo y solicitud de traslado
            </p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar medicamento, principio activo o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {transferNotice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-800 ring-1 ring-blue-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{transferNotice}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Medicamento / Principio Activo</th>
                {BRANCHES.map((b) => (
                  <th key={b.id} className="px-4 py-3">
                    {b.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {availabilityResults.map(({ prod, byBranch }) => {
                const donorBranch = BRANCHES.find((b) => byBranch[b.id].stock >= 10);
                return (
                  <tr key={prod.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{prod.commercialName}</div>
                      <div className="text-xs text-slate-500">
                        {prod.activeIngredient} · {prod.presentation}
                      </div>
                    </td>
                    {BRANCHES.map((b) => {
                      const info = byBranch[b.id];
                      const nearExpiry = info.daysToExpire !== null && info.daysToExpire <= 30;
                      return (
                        <td key={b.id} className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                info.stock === 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {info.stock} uds
                            </span>
                            {nearExpiry && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {info.daysToExpire}d
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{info.aisle}</div>
                          {info.stock === 0 && donorBranch && (
                            <button
                              onClick={() =>
                                handleQuickTransfer(
                                  prod.id,
                                  prod.commercialName,
                                  donorBranch.id,
                                  b.id
                                )
                              }
                              className="mt-1.5 inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              Pedir a {donorBranch.name.replace('Farmacia ', '')}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* GRÁFICOS COMPARATIVOS */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-4 text-base font-bold text-slate-900">
            1. Ventas vs. Ganancia Neta por Sucursal
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Ventas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="GananciaNeta" name="Ganancia Neta" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-4 text-base font-bold text-slate-900">
            2. Ranking de Productos por Sucursal (Unidades)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productRankingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="productName" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {(globalBranch === 'ALL' || globalBranch === 'SUC-01') && (
                  <Bar dataKey="SUC-01" name="Central" fill="#2563eb" />
                )}
                {(globalBranch === 'ALL' || globalBranch === 'SUC-02') && (
                  <Bar dataKey="SUC-02" name="Norte" fill="#10b981" />
                )}
                {(globalBranch === 'ALL' || globalBranch === 'SUC-03') && (
                  <Bar dataKey="SUC-03" name="Sur" fill="#f59e0b" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h3 className="mb-4 text-base font-bold text-slate-900">
            3. Evolución Temporal de Ingresos (Sucursales Superpuestas)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                {BRANCHES.filter(
                  (b) => globalBranch === 'ALL' || globalBranch === b.id
                ).map((b) => (
                  <Line
                    key={b.id}
                    type="monotone"
                    dataKey={b.name}
                    stroke={b.color}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

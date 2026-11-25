'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, DollarSign, PlusCircle, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { BRANCHES } from '@/data/mockData';
import { BranchCode } from '@/types/pharmacy';

export default function PayrollModule() {
  const {
    globalBranch,
    assignedBranch,
    role,
    employees,
    payrolls,
    payPayroll,
    generatePayrollForBranch,
  } = useApp();

  const [periodType, setPeriodType] = useState<'QUINCENAL' | 'MENSUAL'>('QUINCENAL');

  const targetBranchForGen: BranchCode =
    role === 'SUPERADMIN'
      ? globalBranch === 'ALL'
        ? 'SUC-01'
        : globalBranch
      : assignedBranch;

  const visibleEmployees = useMemo(
    () =>
      employees.filter(
        (e) => globalBranch === 'ALL' || e.branchId === globalBranch
      ),
    [employees, globalBranch]
  );

  const visiblePayrolls = useMemo(
    () =>
      payrolls.filter(
        (p) => globalBranch === 'ALL' || p.branchId === globalBranch
      ),
    [payrolls, globalBranch]
  );

  return (
    <div className="space-y-6">
      {/* EMPLEADOS */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Personal por Sucursal
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as 'QUINCENAL' | 'MENSUAL')}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="QUINCENAL">Quincenal</option>
              <option value="MENSUAL">Mensual</option>
            </select>
            <button
              onClick={() => generatePayrollForBranch(targetBranchForGen, periodType)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <PlusCircle className="h-4 w-4" />
              Generar Nómina ({targetBranchForGen})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Sucursal</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Salario Base</th>
                <th className="px-4 py-3">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleEmployees.map((emp) => {
                const b = BRANCHES.find((x) => x.id === emp.branchId)!;
                return (
                  <tr key={emp.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{emp.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">{b.name}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.position}</td>
                    <td className="px-4 py-3 font-medium">${emp.baseSalary.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.commissionPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* HISTORIAL Y PAGO DE NÓMINA */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 text-base font-bold text-slate-900">
          Historial de Nómina (Impacta Ganancia Neta al Pagarse)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Bruto + Com.</th>
                <th className="px-4 py-3">Deducciones</th>
                <th className="px-4 py-3">Neto a Pagar</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visiblePayrolls.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {p.employeeName} <span className="text-xs text-slate-400">({p.branchId})</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{p.periodLabel}</td>
                  <td className="px-4 py-3">${(p.grossSalary + p.commissions + p.bonuses).toFixed(2)}</td>
                  <td className="px-4 py-3 text-rose-600">-${p.legalDeductions.toFixed(2)}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">${p.netPay.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {p.status === 'PAGADA' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Pagada
                      </span>
                    ) : (
                      <button
                        onClick={() => payPayroll(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        Marcar Pagada
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

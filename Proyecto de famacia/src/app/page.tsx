'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Building2,
  Shield,
  Pill,
} from 'lucide-react';
import { AppProvider, useApp } from '@/context/AppContext';
import { BRANCHES } from '@/data/mockData';
import { BranchCode, GlobalBranchFilter, UserRole } from '@/types/pharmacy';
import ExecutiveDashboard from '@/components/ExecutiveDashboard';
import PosModule from '@/components/PosModule';
import InventoryModule from '@/components/InventoryModule';
import PayrollModule from '@/components/PayrollModule';

type TabId = 'dashboard' | 'pos' | 'inventory' | 'payroll';

function MainShell() {
  const { role, assignedBranch, globalBranch, setGlobalBranch, setRoleAndBranch } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Reglas RBAC de visibilidad de módulos
  const canAccessDashboard = role === 'SUPERADMIN' || role === 'ENCARGADO';
  const canAccessInventory = role === 'SUPERADMIN' || role === 'ENCARGADO';
  const canAccessPayroll = role === 'SUPERADMIN' || role === 'ENCARGADO';

  const effectiveTab: TabId =
    role === 'CAJERO'
      ? 'pos'
      : activeTab === 'dashboard' && !canAccessDashboard
      ? 'pos'
      : activeTab;

  const navItems: { id: TabId; label: string; icon: React.ElementType; allowed: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard Ejecutivo', icon: LayoutDashboard, allowed: canAccessDashboard },
    { id: 'pos', label: 'Facturación (POS)', icon: ShoppingCart, allowed: true },
    { id: 'inventory', label: 'Inventario & Traslados', icon: Package, allowed: canAccessInventory },
    { id: 'payroll', label: 'Nómina & Empleados', icon: Users, allowed: canAccessPayroll },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* SIDEBAR */}
      <aside className="no-print hidden w-64 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">FarmaERP</h1>
            <p className="text-[11px] font-medium text-slate-500">Multi-Sucursal POS</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems
            .filter((item) => item.allowed)
            .map((item) => {
              const Icon = item.icon;
              const active = effectiveTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
        </nav>

        {/* SIMULADOR RBAC */}
        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="mb-2 flex items-center gap-1.5 font-bold text-slate-700">
            <Shield className="h-3.5 w-3.5 text-blue-600" />
            Simular Rol (RBAC)
          </div>
          <select
            value={`${role}|${assignedBranch}`}
            onChange={(e) => {
              const [r, b] = e.target.value.split('|') as [UserRole, BranchCode];
              setRoleAndBranch(r, b);
              if (r === 'CAJERO') setActiveTab('pos');
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-medium text-slate-700"
          >
            <option value="SUPERADMIN|SUC-01">Dueño / SuperAdmin (Todas)</option>
            <option value="ENCARGADO|SUC-01">Encargado — Central</option>
            <option value="ENCARGADO|SUC-02">Encargado — Norte</option>
            <option value="ENCARGADO|SUC-03">Encargado — Sur</option>
            <option value="CAJERO|SUC-01">Cajero POS — Central</option>
            <option value="CAJERO|SUC-02">Cajero POS — Norte</option>
          </select>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex flex-1 flex-col">
        {/* TOPBAR CON SELECTOR GLOBAL DE SUCURSAL */}
        <header className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {navItems.find((n) => n.id === effectiveTab)?.label}
            </h2>
            <p className="text-xs text-slate-500">
              Rol activo: <span className="font-semibold text-blue-600">{role}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <select
                value={globalBranch}
                disabled={role !== 'SUPERADMIN'}
                onChange={(e) => setGlobalBranch(e.target.value as GlobalBranchFilter)}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-75"
              >
                {role === 'SUPERADMIN' && (
                  <option value="ALL">Vista Consolidada (Todas las sucursales)</option>
                )}
                {BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          {effectiveTab === 'dashboard' && <ExecutiveDashboard />}
          {effectiveTab === 'pos' && <PosModule />}
          {effectiveTab === 'inventory' && <InventoryModule />}
          {effectiveTab === 'payroll' && <PayrollModule />}
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}

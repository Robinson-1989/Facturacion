import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FarmaERP Multi-Sucursal | Gestión Farmacéutica y POS',
  description: 'Sistema Integral de Gestión Farmacéutica Multi-Sucursal (POS FEFO, Inventario, Nómina y Finanzas)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}

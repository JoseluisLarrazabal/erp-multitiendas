'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react'

type Business = 'Tienda' | 'Lavandería' | 'Consolidado'
type View = 'dashboard' | 'productos' | 'inventario' | 'ventas' | 'compras' | 'clientes' | 'entregas' | 'reportes' | 'caja' | 'configuracion'

const products = [
  { name: 'Refrigerador No Frost 420L', sku: 'LG-GT42WPP', category: 'Línea blanca', brand: 'LG', stock: 8, min: 5, price: 'Bs 6.499', status: 'En stock' },
  { name: 'Lavadora Carga Frontal 9kg', sku: 'SAM-WW90T', category: 'Línea blanca', brand: 'Samsung', stock: 3, min: 5, price: 'Bs 5.299', status: 'Stock bajo' },
  { name: 'Televisor Smart TV 55” UHD', sku: 'SON-K55S30', category: 'Línea negra', brand: 'Sony', stock: 12, min: 4, price: 'Bs 4.799', status: 'En stock' },
  { name: 'Cocina a Gas 6 Hornallas', sku: 'MAB-CM6040', category: 'Línea blanca', brand: 'Mabe', stock: 2, min: 3, price: 'Bs 3.899', status: 'Stock bajo' },
  { name: 'Aspiradora PowerForce', sku: 'ELE-AP200', category: 'Pequeños electrodomésticos', brand: 'Electrolux', stock: 18, min: 6, price: 'Bs 899', status: 'En stock' },
]

const nav = [
  { section: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { section: 'Operación', items: [{ id: 'ventas', label: 'Ventas', icon: ShoppingCart }, { id: 'compras', label: 'Compras', icon: ClipboardList }, { id: 'clientes', label: 'Clientes', icon: Users }, { id: 'entregas', label: 'Entregas e instalación', icon: Truck }] },
  { section: 'Inventario', items: [{ id: 'productos', label: 'Productos', icon: Package }, { id: 'inventario', label: 'Inventario y kardex', icon: Boxes }] },
  { section: 'Finanzas', items: [{ id: 'reportes', label: 'Reportes', icon: BarChart3 }, { id: 'caja', label: 'Caja', icon: CircleDollarSign }] },
]

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 0 }).format(value).replace('BOB', 'Bs')
}

export default function Page() {
  const [business, setBusiness] = useState<Business>('Tienda')
  const [view, setView] = useState<View>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [dialog, setDialog] = useState('')
  const filteredProducts = useMemo(() => products.filter((p) => `${p.name} ${p.sku} ${p.brand}`.toLowerCase().includes(query.toLowerCase())), [query])

  function handleButtonClick(event: React.MouseEvent<HTMLElement>) {
    const button = (event.target as HTMLElement).closest('button')
    if (!button || button.closest('.sidebar')) return
    const label = button.textContent?.replace(/\s+/g, ' ').trim() || 'Acción'
    if (label.includes('Nueva venta') || label.includes('Nuevo producto') || label.includes('Nueva compra') || label.includes('Nuevo cliente') || label.includes('Programar entrega') || label.includes('Nuevo reporte') || label.includes('Registrar movimiento') || label.includes('Guardar cambios')) {
      setDialog(label)
      return
    }
    setFeedback(`${label} listo para usar`)
    window.setTimeout(() => setFeedback(''), 2400)
  }

  const pageMeta: Record<View, [string, string]> = {
    dashboard: ['Buenos días, Carlos', 'Aquí tienes un resumen de lo que ocurre hoy.'],
    ventas: ['Ventas', 'Registra, consulta y da seguimiento a tus ventas.'],
    compras: ['Compras', 'Gestiona proveedores, órdenes y recepciones.'],
    clientes: ['Clientes', 'Conoce el historial y el estado de cuenta de tus clientes.'],
    entregas: ['Entregas e instalación', 'Coordina rutas, entregas y servicios técnicos.'],
    productos: ['Productos', 'Administra el catálogo y el stock de tus productos.'],
    inventario: ['Inventario y kardex', 'Controla existencias, movimientos y transferencias entre sucursales.'],
    reportes: ['Reportes', 'Convierte la operación en decisiones con información clara.'],
    caja: ['Caja', 'Controla ingresos, egresos y cierres por jornada.'],
    configuracion: ['Configuración', 'Personaliza negocios, sucursales, usuarios y permisos.'],
  }
  const [title, subtitle] = pageMeta[view]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-row"><div className="brand-mark"><Sparkles size={17} /></div><span>multinacional</span><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={18} /></button></div>
        <div className="business-switcher" onClick={() => setMenuOpen(!menuOpen)} role="button" tabIndex={0}>
          <div className={`business-icon ${business === 'Lavandería' ? 'laundry' : ''}`}><Store size={17} /></div>
          <div><strong>{business}</strong><small>{business === 'Tienda' ? 'Electrodomésticos' : business === 'Lavandería' ? 'Servicios textiles' : 'Todos los negocios'}</small></div><ChevronDown size={16} className="muted-icon" />
        </div>
        {menuOpen && <div className="business-menu">{(['Tienda', 'Lavandería', 'Consolidado'] as Business[]).map((item) => <button key={item} onClick={() => { setBusiness(item); setMenuOpen(false) }}><span>{item === 'Consolidado' ? <BarChart3 size={16} /> : <Store size={16} />}</span>{item}{item === business && <span className="check">✓</span>}</button>)}</div>}
        <nav>{nav.map((group) => <div className="nav-group" key={group.section}><div className="nav-label">{group.section}</div>{group.items.map((item) => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => { setView(item.id as View); setMobileNav(false) }}><item.icon size={17} /><span>{item.label}</span>{item.id === 'inventario' && <span className="nav-alert">3</span>}</button>)}</div>)}</nav>
        <div className="sidebar-bottom"><button className={`nav-item ${view === 'configuracion' ? 'active' : ''}`} onClick={() => { setView('configuracion'); setMobileNav(false) }}><Settings size={17} /><span>Configuración</span></button><div className="user-card"><div className="avatar">CM</div><div><strong>Carlos Mendoza</strong><small>Administrador</small></div><MoreHorizontal size={17} className="muted-icon" /></div></div>
      </aside>

      <main className="main-content" onClick={handleButtonClick}>
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={20} /></button><div className="breadcrumb"><span>Multinacional</span><ChevronRight size={14} /><strong>{business}</strong></div><div className="top-actions"><div className="global-search"><Search size={16} /><input placeholder="Buscar en Multinacional..." value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>⌘ K</kbd></div><button className="icon-button notification" aria-label="Notificaciones"><Bell size={19} /><i /></button><div className="top-avatar">CM</div></div></header>
        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow">{business === 'Tienda' ? 'OPERACIÓN · COCHABAMBA' : 'VISTA GENERAL'}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{view === 'dashboard' ? <><button className="button secondary"><ArrowDownToLine size={16} />Exportar</button><button className="button primary" onClick={() => setView('productos')}><Plus size={17} />Nueva venta</button></> : <><button className="button secondary"><SlidersHorizontal size={16} />Filtros</button><button className="button primary"><Plus size={17} />{view === 'productos' ? 'Nuevo producto' : 'Nuevo movimiento'}</button></>}</div></div>

          {view === 'dashboard' && <Dashboard business={business} />}
          {view === 'productos' && <ProductsView filteredProducts={filteredProducts} />}
          {view === 'inventario' && <InventoryView />}
          {view === 'ventas' && <SalesView />}
          {view === 'compras' && <PurchasesView />}
          {view === 'clientes' && <CustomersView />}
          {view === 'entregas' && <DeliveriesView />}
          {view === 'reportes' && <ReportsView />}
          {view === 'caja' && <CashView />}
          {view === 'configuracion' && <SettingsView />}
        </div>
        {feedback && <div className="action-toast" role="status">{feedback}</div>}
        {dialog && <div className="action-dialog-backdrop" role="presentation" onClick={() => setDialog('')}><section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" onClick={(event) => event.stopPropagation()}><button className="icon-button dialog-close" onClick={() => setDialog('')} aria-label="Cerrar"><X size={18} /></button><div className="dialog-icon"><Plus size={20} /></div><h2 id="action-dialog-title">{dialog}</h2><p>Esta interfaz está lista para conectarse con el flujo operativo de este módulo.</p><div className="dialog-actions"><button className="button secondary" onClick={() => setDialog('')}>Cancelar</button><button className="button primary" onClick={() => { setDialog(''); setFeedback('Acción creada correctamente'); window.setTimeout(() => setFeedback(''), 2400) }}>Continuar</button></div></section></div>}
      </main>
    </div>
  )
}

function Dashboard({ business }: { business: Business }) {
  return <>
    <div className="metric-grid"><Metric label="Ventas de hoy" value={business === 'Lavandería' ? 'Bs 4.860' : 'Bs 28.450'} change="12,5%" positive icon={<CircleDollarSign size={19} />} /><Metric label="Ventas del mes" value={business === 'Lavandería' ? 'Bs 84.290' : 'Bs 486.240'} change="8,2%" positive icon={<BarChart3 size={19} />} /><Metric label="Ticket promedio" value={business === 'Lavandería' ? 'Bs 142' : 'Bs 2.840'} change="4,6%" positive icon={<ShoppingCart size={19} />} /><Metric label="Alertas activas" value="12" change="3 críticas" icon={<AlertTriangle size={19} />} warning /></div>
    <div className="dashboard-grid"><section className="card sales-card"><div className="card-header"><div><h2>Resumen de ventas</h2><p>Ingresos de los últimos 30 días</p></div><button className="select-button">Últimos 30 días <ChevronDown size={14} /></button></div><div className="chart-area"><div className="y-labels"><span>40k</span><span>30k</span><span>20k</span><span>10k</span><span>0</span></div><div className="chart"><div className="grid-lines" /> <svg viewBox="0 0 700 190" preserveAspectRatio="none" aria-label="Gráfico de ventas"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6157e8" stopOpacity=".22" /><stop offset="1" stopColor="#6157e8" stopOpacity="0" /></linearGradient></defs><path d="M0,145 C40,133 56,150 87,127 S145,90 175,116 S230,70 265,95 S320,117 350,78 S405,82 438,56 S485,94 520,66 S566,25 600,55 S655,33 700,20 L700,190 L0,190Z" fill="url(#fill)"/><path d="M0,145 C40,133 56,150 87,127 S145,90 175,116 S230,70 265,95 S320,117 350,78 S405,82 438,56 S485,94 520,66 S566,25 600,55 S655,33 700,20" fill="none" stroke="#6157e8" strokeWidth="3" /></svg><div className="x-labels"><span>24 sep</span><span>30 sep</span><span>06 oct</span><span>12 oct</span><span>18 oct</span><span>22 oct</span></div></div></div></section><section className="card alerts-card"><div className="card-header"><div><h2>Requiere atención</h2><p>Alertas que necesitan seguimiento</p></div><button className="text-button">Ver todo <ArrowUpRight size={14} /></button></div><div className="alert-list"><AlertRow icon={<Package size={17} />} title="Stock bajo" detail="Lavadora Carga Frontal 9kg" meta="3 unidades" tone="warning" /><AlertRow icon={<Clock3 size={17} />} title="Cuotas vencidas" detail="5 clientes con pagos pendientes" meta="Bs 12.480" tone="danger" /><AlertRow icon={<Truck size={17} />} title="Entregas de hoy" detail="3 instalaciones programadas" meta="Hoy, 15:00" tone="info" /></div></section></div>
    <div className="bottom-grid"><section className="card"><div className="card-header"><div><h2>Ventas recientes</h2><p>Últimas transacciones registradas</p></div><button className="text-button">Ver todas <ArrowUpRight size={14} /></button></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Venta</th><th>Vendedor</th><th>Estado</th><th className="number">Total</th></tr></thead><tbody><tr><td><div className="customer"><div className="mini-avatar purple">JR</div><strong>José Rojas</strong></div></td><td>#V-002481</td><td>María López</td><td><span className="status success">Completada</span></td><td className="number strong">Bs 6.499</td></tr><tr><td><div className="customer"><div className="mini-avatar orange">AM</div><strong>Ana María Vargas</strong></div></td><td>#V-002480</td><td>Pedro Suárez</td><td><span className="status pending">Pendiente</span></td><td className="number strong">Bs 2.840</td></tr><tr><td><div className="customer"><div className="mini-avatar blue">RG</div><strong>Ricardo Gómez</strong></div></td><td>#V-002479</td><td>María López</td><td><span className="status success">Completada</span></td><td className="number strong">Bs 1.299</td></tr></tbody></table></div></section><section className="card top-products"><div className="card-header"><div><h2>Productos más vendidos</h2><p>Este mes</p></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><div className="product-list"><ProductRow rank="01" name="Refrigerador No Frost 420L" sold="24 vendidos" value="Bs 155.976" /><ProductRow rank="02" name="Televisor Smart TV 55” UHD" sold="18 vendidos" value="Bs 86.382" /><ProductRow rank="03" name="Lavadora Carga Frontal 9kg" sold="15 vendidos" value="Bs 79.485" /></div></section></div>
  </>
}

function Metric({ label, value, change, positive, icon, warning }: { label: string; value: string; change: string; positive?: boolean; icon: React.ReactNode; warning?: boolean }) { return <div className="metric card"><div className={`metric-icon ${warning ? 'warning' : ''}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className={`metric-change ${warning ? 'danger-text' : positive ? 'positive' : ''}`}>{positive && <ArrowUpRight size={14} />}{change}</div></div> }
function AlertRow({ icon, title, detail, meta, tone }: { icon: React.ReactNode; title: string; detail: string; meta: string; tone: string }) { return <div className="alert-row"><div className={`alert-icon ${tone}`}>{icon}</div><div className="alert-copy"><strong>{title}</strong><span>{detail}</span></div><b>{meta}</b><ChevronRight size={16} className="muted-icon" /></div> }
function ProductRow({ rank, name, sold, value }: { rank: string; name: string; sold: string; value: string }) { return <div className="product-row"><span className="rank">{rank}</span><div className="product-thumb"><Package size={18} /></div><div className="product-copy"><strong>{name}</strong><span>{sold}</span></div><b>{value}</b></div> }

const moduleData = {
  sales: { title: 'Ventas recientes', description: 'Ordena por estado, vendedor o sucursal.', action: 'Nueva venta', columns: ['Cliente', 'Venta', 'Vendedor', 'Estado', 'Total'], rows: [['José Rojas', '#V-002481', 'María López', 'Completada', 'Bs 6.499'], ['Ana María Vargas', '#V-002480', 'Pedro Suárez', 'Pendiente', 'Bs 2.840'], ['Ricardo Gómez', '#V-002479', 'María López', 'Completada', 'Bs 1.299']] },
  purchases: { title: 'Órdenes de compra', description: 'Sigue el abastecimiento de cada sucursal.', action: 'Nueva compra', columns: ['Proveedor', 'Orden', 'Entrega estimada', 'Estado', 'Total'], rows: [['Samsung Bolivia', '#OC-00182', '28 oct 2026', 'En tránsito', 'Bs 48.620'], ['Importadora LG', '#OC-00181', '30 oct 2026', 'Pendiente', 'Bs 32.400'], ['Mabe Bolivia', '#OC-00180', 'Completada', 'Completada', 'Bs 18.900']] },
  customers: { title: 'Cartera de clientes', description: 'Consulta compras, pagos y crédito disponible.', action: 'Nuevo cliente', columns: ['Cliente', 'Contacto', 'Última compra', 'Estado de cuenta', 'Total comprado'], rows: [['José Rojas', '700 482 19', 'Hoy, 09:48', 'Al día', 'Bs 18.940'], ['Ana María Vargas', '722 104 33', 'Ayer, 16:20', 'Pendiente', 'Bs 7.280'], ['Ricardo Gómez', '774 802 11', '18 oct 2026', 'Al día', 'Bs 12.490']] },
} as const

function ModuleTable({ kind }: { kind: keyof typeof moduleData }) {
  const data = moduleData[kind]
  return <section className="card module-card"><div className="module-toolbar"><div className="table-search"><Search size={16} /><input placeholder={`Buscar ${kind === 'sales' ? 'venta' : kind === 'purchases' ? 'orden o proveedor' : 'cliente'}...`} /></div><div className="filter-pills"><button className="select-button">Todos los estados <ChevronDown size={14} /></button><button className="button primary"><Plus size={16} />{data.action}</button></div></div><div className="module-summary"><div><span>Registros este mes</span><strong>128</strong></div><div><span>Por confirmar</span><strong className="warning-text">12</strong></div><div><span>Valor acumulado</span><strong>Bs 486.240</strong></div></div><div className="table-wrap"><table><thead><tr>{data.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{data.rows.map((row) => <tr key={row[1]}>{row.map((cell, index) => <td key={`${row[1]}-${cell}`} className={index === 4 ? 'strong number' : ''}>{index === 3 ? <span className={`status ${cell === 'Completada' || cell === 'Al día' ? 'success' : 'pending'}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div><div className="pagination"><span>Mostrando 3 de 128 registros</span><div><button className="page-button active">1</button><button className="page-button">2</button><button className="page-button">Siguiente</button></div></div></section>
}
function SalesView() { return <ModuleTable kind="sales" /> }
function PurchasesView() { return <ModuleTable kind="purchases" /> }
function CustomersView() { return <ModuleTable kind="customers" /> }
function DeliveriesView() { return <OperationsBoard title="Agenda de entregas e instalación" action="Programar entrega" items={[['Hoy · 15:00', 'José Rojas · Refrigerador No Frost', 'Casa Matriz → Av. América 1420', 'En ruta'], ['Hoy · 17:30', 'Ana María Vargas · Lavadora 9kg', 'Sucursal Norte → Cala Cala', 'Programada'], ['Mañana · 09:00', 'Ricardo Gómez · Instalación TV 55”', 'Servicio técnico · Queru Queru', 'Confirmada']]} /> }
function ReportsView() { return <OperationsBoard title="Centro de reportes" action="Nuevo reporte" items={[['Ventas', 'Resumen de ventas por negocio', 'Última actualización: hoy, 10:30', 'Disponible'], ['Inventario', 'Valorización y rotación de stock', 'Última actualización: ayer, 18:00', 'Disponible'], ['Finanzas', 'Flujo de caja y cuentas por cobrar', 'Última actualización: hoy, 09:15', 'Disponible']]} /> }
function CashView() { return <OperationsBoard title="Control de caja" action="Registrar movimiento" items={[['Caja principal', 'Saldo de apertura · Carlos Mendoza', 'Bs 12.500 · Hoy, 08:00', 'Abierta'], ['Caja sucursal norte', 'Saldo de apertura · María López', 'Bs 4.200 · Hoy, 09:00', 'Abierta'], ['Cierre anterior', 'Caja principal · 21 de octubre', 'Diferencia: Bs 0', 'Cerrada']]} /> }
function SettingsView() { return <OperationsBoard title="Configuración del sistema" action="Guardar cambios" items={[['Negocios y sucursales', 'Tienda · Lavandería · 2 ubicaciones', 'Gestiona datos fiscales y horarios', 'Activo'], ['Usuarios y permisos', '4 usuarios con acceso', 'Administra roles y módulos', 'Activo'], ['Métodos de pago', 'Efectivo · QR · Tarjeta · Crédito', 'Configura opciones de cobro', 'Activo']]} /> }
function OperationsBoard({ title, action, items }: { title: string; action: string; items: string[][] }) { return <section className="card operations-board"><div className="card-header"><div><h2>{title}</h2><p>Información centralizada para tomar acción sin perder contexto.</p></div><button className="button primary"><Plus size={16} />{action}</button></div><div className="operation-list">{items.map(([label, name, detail, status]) => <div className="operation-row" key={name}><div className="operation-icon"><ClipboardList size={18} /></div><div className="operation-copy"><strong>{name}</strong><span>{label} · {detail}</span></div><span className={`status ${status === 'Cerrada' ? 'success' : 'pending'}`}>{status}</span><ChevronRight size={17} className="muted-icon" /></div>)}</div></section> }

function ProductsView({ filteredProducts }: { filteredProducts: typeof products }) { return <section className="card product-table-card"><div className="filter-row"><div className="table-search"><Search size={16} /><input placeholder="Buscar por nombre, SKU o marca..." /></div><div className="filter-pills"><button className="select-button">Categoría <ChevronDown size={14} /></button><button className="select-button">Marca <ChevronDown size={14} /></button></div></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Categoría</th><th>Stock</th><th>Precio venta</th><th>Estado</th><th /></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.sku}><td><div className="product-cell"><div className="product-thumb large"><Package size={19} /></div><div><strong>{product.name}</strong><span>{product.brand}</span></div></div></td><td className="mono">{product.sku}</td><td>{product.category}</td><td><strong>{product.stock}</strong> <span className="muted">/ mín. {product.min}</span></td><td className="strong">{product.price}</td><td><span className={`status ${product.status === 'En stock' ? 'success' : 'pending'}`}>{product.status}</span></td><td><button className="icon-button"><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div><div className="pagination"><span>Mostrando {filteredProducts.length} de 40 productos</span><div><button className="page-button">Anterior</button><button className="page-button active">1</button><button className="page-button">2</button><button className="page-button">Siguiente</button></div></div></section> }
function InventoryView() { return <div className="inventory-grid"><section className="card inventory-overview"><div className="card-header"><div><h2>Resumen de inventario</h2><p>Valor actual por sucursal</p></div><button className="select-button">Todas las sucursales <ChevronDown size={14} /></button></div><div className="inventory-stats"><div><span>Valor total</span><strong>Bs 1.248.620</strong></div><div><span>Unidades</span><strong>486</strong></div><div><span>Stock bajo</span><strong className="danger-text">12</strong></div></div><div className="stock-bars"><div><span><b>Casa Matriz · Cochabamba</b><em>Bs 824.300</em></span><i><u style={{ width: '76%' }} /></i></div><div><span><b>Sucursal Norte · Cochabamba</b><em>Bs 424.320</em></span><i><u style={{ width: '43%' }} /></i></div></div></section><section className="card movements"><div className="card-header"><div><h2>Movimientos recientes</h2><p>Últimas entradas y salidas</p></div><button className="text-button">Ver kardex <ArrowUpRight size={14} /></button></div>{[['Entrada', 'Compra · Samsung Bolivia', '+24', 'Hoy, 10:32'], ['Salida', 'Venta · #V-002481', '-1', 'Hoy, 09:48'], ['Transferencia', 'Casa Matriz → Sucursal Norte', '8', 'Ayer, 16:20']].map(([type, detail, qty, time]) => <div className="movement-row" key={detail}><div className={`movement-dot ${type === 'Entrada' ? 'in' : type === 'Salida' ? 'out' : 'transfer'}`}>{type === 'Entrada' ? <ArrowDownToLine size={15} /> : type === 'Salida' ? <ArrowUpRight size={15} /> : <Truck size={15} />}</div><div><strong>{type}</strong><span>{detail}</span></div><b>{qty}</b><small>{time}</small></div>)}</section></div> }

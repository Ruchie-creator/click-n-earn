import { ChangeEvent, ReactNode, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Copy,
  CreditCard,
  FileCheck2,
  FileClock,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Landmark,
  LayoutDashboard,
  Link2,
  ListChecks,
  LogOut,
  Menu,
  MoreHorizontal,
  Network,
  Pencil,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  UploadCloud,
  UserCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import type { Task } from './data'

export type AppPage =
  | 'landing'
  | 'how'
  | 'login'
  | 'register'
  | 'forgot'
  | 'dashboard'
  | 'tasks'
  | 'my-tasks'
  | 'task-detail'
  | 'proof'
  | 'earnings'
  | 'referrals'
  | 'payouts'
  | 'notifications'
  | 'profile'
  | 'admin-dashboard'
  | 'admin-tasks'
  | 'admin-submissions'
  | 'admin-verification'
  | 'admin-payouts'
  | 'admin-users'
  | 'admin-referrals'
  | 'admin-transactions'
  | 'admin-notifications'
  | 'admin-settings'

export type StatusTone = 'success' | 'warning' | 'processing' | 'error' | 'info' | 'neutral'

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount)

export function Logo({ onClick, compact = false, light = false }: { onClick?: () => void; compact?: boolean; light?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`group flex items-center gap-3 text-left ${onClick ? 'focus-visible-only' : ''}`} aria-label="Click & Earn home">
      <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl ${light ? 'bg-white/10' : 'bg-navy'} shadow-sm`}>
        <span className="absolute h-4 w-4 rounded-[5px] border-2 border-white" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-[#8BB1E4]" />
      </span>
      {!compact && <span className={`text-[17px] font-bold tracking-[-0.04em] ${light ? 'text-white' : 'text-ink'}`}>Click <span className={light ? 'text-[#8BB1E4]' : 'text-accent'}>&amp;</span> Earn</span>}
    </button>
  )
}

export function Avatar({ initials, size = 'md', tone = 'navy' }: { initials: string; size?: 'sm' | 'md' | 'lg'; tone?: 'navy' | 'indigo' | 'blue' }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-sm' : 'h-10 w-10 text-xs'
  const toneClass = tone === 'indigo' ? 'bg-indigo text-white' : tone === 'blue' ? 'bg-soft-blue text-navy' : 'bg-[#E7EDF5] text-navy'
  return <span className={`grid shrink-0 place-items-center rounded-full font-bold ${sizeClass} ${toneClass}`}>{initials}</span>
}

export function StatusBadge({ children, tone = 'neutral', dot = false }: { children: ReactNode; tone?: StatusTone; dot?: boolean }) {
  const toneClasses: Record<StatusTone, string> = {
    success: 'bg-[#ECFDF3] text-success',
    warning: 'bg-[#FFF7ED] text-warning',
    processing: 'bg-[#EFF6FF] text-processing',
    error: 'bg-[#FEF2F2] text-error',
    info: 'bg-[#F0F9FF] text-info',
    neutral: 'bg-[#F2F4F7] text-muted',
  }
  const dotClasses: Record<StatusTone, string> = {
    success: 'bg-success',
    warning: 'bg-warning',
    processing: 'bg-processing',
    error: 'bg-error',
    info: 'bg-info',
    neutral: 'bg-subtle',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClasses[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} />}
      {children}
    </span>
  )
}

export function StatCard({ label, value, helper, icon: Icon, tone = 'navy', trend, onClick }: { label: string; value: string; helper: string; icon: LucideIcon; tone?: 'navy' | 'blue' | 'green' | 'orange'; trend?: string; onClick?: () => void }) {
  const iconTone = { navy: 'bg-[#E8EEF6] text-navy', blue: 'bg-[#EAF2FF] text-processing', green: 'bg-[#ECFDF3] text-success', orange: 'bg-[#FFF7ED] text-warning' }[tone]
  const cardClass = onClick ? 'lift cursor-pointer' : ''
  return (
    <button type={onClick ? 'button' : undefined} onClick={onClick} className={`card w-full p-4 text-left sm:p-5 ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${iconTone}`}><Icon size={19} strokeWidth={1.9} /></span>
        {trend && <span className="text-[11px] font-semibold text-success">{trend}</span>}
      </div>
      <p className="mt-5 text-[12px] font-medium text-muted">{label}</p>
      <p className="number mt-1 text-[24px] font-semibold tracking-[-0.04em] text-navy">{value}</p>
      <p className="mt-1 text-[11px] text-subtle">{helper}</p>
    </button>
  )
}

export function PageHeader({ eyebrow, title, description, actions, back }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; back?: () => void }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <button onClick={back} className="btn-ghost -ml-3 mb-3"><ArrowLeft size={16} /> Back</button>}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-[27px] font-semibold leading-tight tracking-[-0.04em] text-ink [text-wrap:balance] sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted [text-wrap:pretty]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function TaskCard({ task, onView }: { task: Task; onView: (task: Task) => void }) {
  const status = task.status.toLowerCase()
  const statusTone: StatusTone = status === 'available' || status === 'funded' ? 'success' : status.includes('pause') ? 'warning' : status.includes('reject') ? 'error' : 'neutral'
  return (
    <article className="card lift overflow-hidden">
      <div className="relative aspect-[1.65/1] overflow-hidden bg-[#E9EEF5]">
        {task.image && <img src={task.image} alt="" className="task-image h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]" />}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <StatusBadge tone={statusTone} dot>{task.status}</StatusBadge>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-navy shadow-sm">{task.category}</span>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="min-h-[74px]">
          <h3 className="text-[15px] font-semibold leading-5 text-ink">{task.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">{task.shortDescription}</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-line py-3">
          <div><p className="text-[10px] text-subtle">Purchase reimbursement</p><p className="number mt-1 text-sm font-semibold text-ink">{formatCurrency(task.productPrice)}</p></div>
          <div><p className="text-[10px] text-subtle">Incentive</p><p className="number mt-1 text-sm font-semibold text-success">+{formatCurrency(task.incentive)}</p></div>
          <div><p className="text-[10px] text-subtle">Expected payout</p><p className="number mt-1 text-sm font-semibold text-navy">{formatCurrency(task.productPrice + task.incentive)}</p></div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted"><span className="font-semibold text-ink">{task.slots}</span> slots available</span>
          <button onClick={() => onView(task)} className="btn-secondary min-h-9 px-3 text-xs">View task <ArrowUpRight size={14} /></button>
        </div>
      </div>
    </article>
  )
}

export function FileUpload({ files, onFilesChange, onFilesSelected }: { files: string[]; onFilesChange: (files: string[]) => void; onFilesSelected?: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? [])
    const selected = selectedFiles.slice(0, 1)
    onFilesSelected?.(selected)
    if (selected.length) onFilesChange([selected[0].name])
    event.target.value = ''
  }
  return (
    <div>
      <button type="button" onClick={() => inputRef.current?.click()} className="focus-ring group flex min-h-[148px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#B8C7D9] bg-[#FBFCFE] px-5 text-center transition-[border-color,background-color] duration-200 hover:border-accent hover:bg-soft-blue">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-soft-blue text-navy transition-transform duration-200 group-hover:scale-105"><UploadCloud size={20} /></span>
        <span className="mt-3 text-sm font-semibold text-ink">Click to upload proof</span>
        <span className="mt-1 text-xs text-muted">PNG, JPG or PDF · max 10MB</span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={handleChange} />
      {files.length > 0 && <div className="mt-3 space-y-2">{files.map((file, index) => <div key={`${file}-${index}`} className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2.5"><div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-soft-blue text-navy"><FileText size={15} /></span><span className="truncate text-xs font-medium text-ink">{file}</span></div><button onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className="btn-ghost min-h-8 px-2 text-subtle hover:text-error" aria-label={`Remove ${file}`}><X size={15} /></button></div>)}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon = ClipboardList, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="card flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-soft-blue text-navy"><Icon size={22} /></span><h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>{action && <div className="mt-4">{action}</div>}</div>
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="fixed bottom-5 left-1/2 z-[80] flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-navy px-4 py-3 text-sm font-medium text-white shadow-soft fade-up"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-[#B9D7FF]"><Check size={14} /></span><span className="flex-1">{message}</span><button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Dismiss notification"><X size={15} /></button></div>
}

function navIcon(page: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    tasks: ListChecks,
    'my-tasks': ClipboardList,
    earnings: WalletCards,
    referrals: UsersRound,
    payouts: Landmark,
    notifications: Bell,
    profile: UserRound,
    'admin-dashboard': LayoutDashboard,
    'admin-tasks': ListChecks,
    'admin-submissions': FileClock,
    'admin-verification': ClipboardCheck,
    'admin-payouts': Landmark,
    'admin-users': UsersRound,
    'admin-referrals': Network,
    'admin-transactions': ReceiptText,
    'admin-notifications': Bell,
    'admin-settings': Settings2,
  }
  return icons[page] ?? LayoutDashboard
}

export function Sidebar({ admin, page, onNavigate, mobileOpen, onClose, onSwitchMode, canAccessAdmin, onLogout, unreadCount = 0, reviewCount = 0 }: { admin: boolean; page: AppPage; onNavigate: (page: AppPage) => void; mobileOpen: boolean; onClose: () => void; onSwitchMode: () => void; canAccessAdmin: boolean; onLogout: () => void; unreadCount?: number; reviewCount?: number }) {
  const groups = admin ? [
    { label: 'Command center', items: [['admin-dashboard', 'Dashboard'], ['admin-tasks', 'Tasks'], ['admin-submissions', 'Submissions'], ['admin-verification', 'Verification queue'], ['admin-payouts', 'Payouts']] },
    { label: 'Manage', items: [['admin-users', 'Users'], ['admin-referrals', 'Referrals'], ['admin-transactions', 'Transactions']] },
    { label: 'System', items: [['admin-notifications', 'Notifications'], ['admin-settings', 'Settings']] },
  ] : [
    { label: 'Overview', items: [['dashboard', 'Dashboard'], ['tasks', 'Available tasks'], ['my-tasks', 'My tasks']] },
    { label: 'Money', items: [['earnings', 'Earnings'], ['referrals', 'Referrals'], ['payouts', 'Payouts']] },
    { label: 'Account', items: [['notifications', 'Notifications'], ['profile', 'Profile']] },
  ]
  return <>
    <div onClick={onClose} className={`fixed inset-0 z-40 bg-navy/35 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <aside className={`sidebar-scroll dark-scroll fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col overflow-y-auto bg-navy text-white transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-5"><Logo light /><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white md:hidden" aria-label="Close navigation"><X size={18} /></button></div>
      <div className="flex flex-1 flex-col px-3 py-5">
        {admin && <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[#B9D7FF]"><ShieldCheck size={16} /></span><div><p className="text-[11px] font-semibold text-white">Admin workspace</p><p className="mt-0.5 text-[10px] text-white/50">Click & Earn operations</p></div></div>}
        <nav className="space-y-6">{groups.map((group) => <div key={group.label}><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">{group.label}</p><div className="mt-2 space-y-1">{group.items.map(([itemPage, label]) => { const Icon = navIcon(itemPage); const active = page === itemPage; const count = itemPage === 'notifications' ? unreadCount : itemPage === 'admin-verification' ? reviewCount : 0; return <button key={itemPage} onClick={() => { onNavigate(itemPage as AppPage); onClose() }} className={`sidebar-link flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium transition-[background-color,color] duration-200 ${active ? 'bg-white text-navy shadow-sm' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.8} /><span className="flex-1">{label}</span>{count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-soft-blue text-navy' : 'bg-white/10 text-white/65'}`}>{count}</span>}</button> })}</div></div>)}</nav>
        <div className="mt-auto pt-6"><div className="rounded-2xl border border-white/10 bg-white/5 p-3.5"><div className="flex items-start justify-between"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[#B9D7FF]"><HelpCircle size={16} /></span><button className="text-white/35 hover:text-white"><MoreHorizontal size={17} /></button></div><p className="mt-3 text-xs font-semibold text-white">Need a hand?</p><p className="mt-1 text-[11px] leading-4 text-white/50">Our support team is here to help with submissions.</p><button className="mt-3 text-[11px] font-semibold text-[#B9D7FF] hover:text-white">Visit help center <ArrowRight className="ml-1 inline" size={12} /></button></div>{canAccessAdmin && <button onClick={onSwitchMode} className="mt-3 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"><ArrowDownUp size={15} />{admin ? 'Switch to member view' : 'Open admin workspace'}</button>}<button onClick={() => onNavigate('landing')} className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"><ArrowRight size={15} />View public site</button><button onClick={onLogout} className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"><LogOut size={15} />Sign out</button></div>
      </div>
    </aside>
  </>
}

export function Topbar({ admin, userName, unreadCount, onMenu, onNavigate, onToast }: { admin: boolean; userName: string; unreadCount: number; onMenu: () => void; onNavigate: (page: AppPage) => void; onToast: (message: string) => void }) {
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '—'
  return <header className="sticky top-0 z-30 flex h-[64px] items-center border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 md:h-[76px] lg:px-8"><div className="flex min-w-0 flex-1 items-center gap-3"><button onClick={onMenu} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft-blue hover:text-navy md:hidden" aria-label="Open navigation"><Menu size={20} /></button><div className="relative hidden w-full max-w-[290px] sm:block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><input className="form-field h-10 bg-canvas pl-9 pr-3 text-xs" placeholder={admin ? 'Search users, tasks...' : 'Search tasks...'} /></div></div><div className="flex items-center gap-1.5 sm:gap-2"><ClientPreviewBadge /><button className="grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-blue hover:text-navy" onClick={() => onToast('Help center is not configured.')} aria-label="Open help center"><HelpCircle size={19} /></button><button onClick={() => onNavigate(admin ? 'admin-notifications' : 'notifications')} className="relative grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-blue hover:text-navy" aria-label={`${unreadCount} unread notifications`}><Bell size={19} />{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-error px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button><div className="ml-1 h-7 w-px bg-line" /><button onClick={() => onNavigate(admin ? 'admin-settings' : 'profile')} className="flex min-h-10 items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-soft-blue"><Avatar initials={initials} size="sm" tone={admin ? 'indigo' : 'navy'} /><span className="hidden max-w-[110px] truncate text-xs font-semibold text-ink sm:block">{userName || '—'}</span><ChevronDown size={14} className="hidden text-subtle sm:block" /></button></div></header>
}

export function ClientPreviewBadge() {
  if (import.meta.env.VITE_CLIENT_PREVIEW !== 'true') return null
  return <span title="Client Preview environment" aria-label="Client Preview environment" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#D9E2EC] bg-[#EEF3FA] px-2.5 py-1.5 text-[10px] font-semibold text-navy"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#4F6FAE]" /><span className="hidden sm:inline">Client Preview</span><span className="sm:hidden">Preview</span></span>
}

export function CopyButton({ value, onCopied }: { value: string; onCopied?: () => void }) {
  return <button disabled={!value} onClick={async () => { try { if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.'); await navigator.clipboard.writeText(value); onCopied?.() } catch { /* Clipboard denial should not be reported as a successful copy. */ } }} className="btn-secondary min-h-10 shrink-0 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"><Copy size={14} />Copy</button>
}

export function Modal({ open, title, description, onClose, children, size = 'md' }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  if (!open) return null
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-soft sm:rounded-2xl sm:p-6 ${width}`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-muted">{description}</p>}</div><button onClick={onClose} className="btn-ghost -mr-2 -mt-2 min-h-9 px-2 text-muted" aria-label="Close modal"><X size={18} /></button></div><div className="mt-5">{children}</div></div></div>
}

export function TableEmpty({ message }: { message: string }) {
  return <div className="flex items-center justify-center px-4 py-10 text-sm text-muted">{message}</div>
}

export const utilityIcons = { ArrowUpRight, ArrowRight, ChevronRight, Search, Pencil, Tag, Link2, CreditCard, BadgeDollarSign, CircleDollarSign, FileCheck2, BookOpenCheck, Activity, UserCheck, Clock3, Sparkles, ImageIcon }

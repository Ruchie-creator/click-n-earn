import { ChangeEvent, ReactNode, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  Bookmark,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  CheckCheck,
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
  Info,
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
import type { NotificationItem, Task } from './data'
import type { ApiUser } from './api/contracts'
import { api } from './api'
import type { ToastKind } from './feedback'

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
  | 'admin-profile'

export type StatusTone = 'success' | 'warning' | 'processing' | 'error' | 'info' | 'neutral'

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

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

export function Avatar({ initials, size = 'md', tone = 'navy', src, alt = '' }: { initials: string; size?: 'sm' | 'md' | 'lg'; tone?: 'navy' | 'indigo' | 'blue'; src?: string | null; alt?: string }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-sm' : 'h-10 w-10 text-xs'
  const toneClass = tone === 'indigo' ? 'bg-indigo text-white' : tone === 'blue' ? 'bg-soft-blue text-navy' : 'bg-[#E7EDF5] text-navy'
  return <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-bold ${sizeClass} ${toneClass}`}>
    {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : initials}
  </span>
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

export function FileUpload({ files, onFilesChange, onFilesSelected, selectedFile }: { files: string[]; onFilesChange: (files: string[]) => void; onFilesSelected?: (files: File[]) => void; selectedFile?: File | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])
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
      {files.length > 0 && <div className="mt-3 rounded-xl border border-line bg-white p-3">
        {selectedFile && previewUrl && <div className="mb-3 overflow-hidden rounded-lg border border-line bg-canvas">
          {selectedFile.type.startsWith('image/') ? <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full" aria-label={`Open a larger preview of ${selectedFile.name}`}><img src={previewUrl} alt={`Preview of ${selectedFile.name}`} className="max-h-52 w-full object-contain" /></button>
            : selectedFile.type === 'application/pdf' ? <iframe title={`Preview of ${selectedFile.name}`} src={previewUrl} className="h-48 w-full bg-white" /> : null}
        </div>}
        {files.map((file, index) => <div key={`${file}-${index}`} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-soft-blue text-navy">{selectedFile?.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{file}</p><p className="mt-0.5 text-[11px] text-muted">{selectedFile ? formatFileSize(selectedFile.size) : 'Selected proof file'}</p></div>
          {selectedFile?.type.startsWith('image/') && <button type="button" onClick={() => setPreviewOpen(true)} className="btn-ghost min-h-9 px-2 text-xs">Preview</button>}
          {selectedFile?.type === 'application/pdf' && previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-ghost min-h-9 px-2 text-xs">Open PDF</a>}
          <button type="button" onClick={() => { onFilesChange(files.filter((_, fileIndex) => fileIndex !== index)); onFilesSelected?.([]) }} className="btn-ghost min-h-9 px-2 text-subtle hover:text-error" aria-label={`Remove ${file}`}><X size={15} /></button>
        </div>)}
      </div>}
      <Modal open={previewOpen && Boolean(previewUrl && selectedFile?.type.startsWith('image/'))} title={selectedFile?.name || 'Proof preview'} description="Review the selected image before submitting your proof." onClose={() => setPreviewOpen(false)} size="lg">
        {previewUrl && <img src={previewUrl} alt={`Larger preview of ${selectedFile?.name || 'selected proof'}`} className="mx-auto max-h-[72dvh] max-w-full rounded-xl object-contain shadow-sm" />}
      </Modal>
    </div>
  )
}

export function EmptyState({ icon: Icon = ClipboardList, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="card flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-soft-blue text-navy"><Icon size={22} /></span><h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>{action && <div className="mt-4">{action}</div>}</div>
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast-card toast-info" role="status"><span className="toast-icon"><Info size={17} /></span><span className="flex-1 text-sm font-medium">{message}</span><button onClick={onClose} className="toast-dismiss" aria-label="Dismiss notification"><X size={15} /></button></div>
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
    'admin-profile': UserRound,
  }
  return icons[page] ?? LayoutDashboard
}

export function Sidebar({ admin, page, onNavigate, mobileOpen, onClose, onSwitchMode, canAccessAdmin, onLogout, unreadCount = 0, reviewCount = 0 }: { admin: boolean; page: AppPage; onNavigate: (page: AppPage) => void; mobileOpen: boolean; onClose: () => void; onSwitchMode: () => void; canAccessAdmin: boolean; onLogout: () => void; unreadCount?: number; reviewCount?: number }) {
  const groups = admin ? [
    { label: 'Command center', items: [['admin-dashboard', 'Dashboard'], ['admin-tasks', 'Tasks'], ['admin-submissions', 'Submissions'], ['admin-verification', 'Verification queue'], ['admin-payouts', 'Payouts']] },
    { label: 'Manage', items: [['admin-users', 'Users'], ['admin-referrals', 'Referrals'], ['admin-transactions', 'Transactions']] },
    { label: 'System', items: [['admin-notifications', 'Notifications'], ['admin-settings', 'Settings'], ['admin-profile', 'Profile']] },
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

export function Topbar({ admin, user, userName, unreadCount, notifications = [], onMenu, onNavigate, onToast, onLogout, onRefresh, onNotificationSelect }: { admin: boolean; user?: ApiUser | null; userName: string; unreadCount: number; notifications?: NotificationItem[]; onMenu: () => void; onNavigate: (page: AppPage) => void; onToast: (message: string, kind?: ToastKind) => void; onLogout: () => void; onRefresh: () => Promise<void>; onNotificationSelect: (notification: NotificationItem) => void }) {
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '—'
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null)
  const menuRoot = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const notificationTrigger = useRef<HTMLButtonElement>(null)
  const profileTrigger = useRef<HTMLButtonElement>(null)
  const menuName = openMenu

  useEffect(() => {
    if (!openMenu) return
    const closeOutside = (event: PointerEvent) => { if (!menuRoot.current?.contains(event.target as Node)) setOpenMenu(null) }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [openMenu])

  useEffect(() => {
    if (!openMenu) return
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
  }, [openMenu])

  const closeMenu = (restoreFocus = false) => {
    setOpenMenu(null)
    if (restoreFocus) (menuName === 'notifications' ? notificationTrigger.current : profileTrigger.current)?.focus()
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])
    if (!items.length) return
    event.preventDefault()
    const activeIndex = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (activeIndex + 1) % items.length : (activeIndex <= 0 ? items.length - 1 : activeIndex - 1)
    items[next].focus()
  }

  const toggleMenu = (name: 'notifications' | 'profile') => setOpenMenu((current) => current === name ? null : name)
  const selectNotification = async (notification: NotificationItem) => {
    closeMenu()
    try {
      if (notification.unread) await api.markNotificationRead(notification.id)
      await onRefresh()
    } catch {
      onToast('We could not update that notification. Opening its related section.', 'warning')
    }
    onNotificationSelect(notification)
  }
  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      await onRefresh()
      onToast('Notifications marked as read.', 'success')
    } catch {
      onToast('We could not update notifications. Please try again.', 'error')
    }
  }
  const profileLinks: Array<{ label: string; page?: AppPage; action?: () => void }> = admin
    ? [{ label: 'Admin dashboard', page: 'admin-dashboard' }, { label: 'Settings', page: 'admin-settings' }, { label: 'Profile', page: 'admin-profile' }, { label: 'Notifications', page: 'admin-notifications' }, { label: 'Sign out', action: onLogout }]
    : [{ label: 'Dashboard', page: 'dashboard' }, { label: 'Available tasks', page: 'tasks' }, { label: 'Profile', page: 'profile' }, { label: 'Notifications', page: 'notifications' }, { label: 'Sign out', action: onLogout }]

  return <header className="sticky top-0 z-30 flex h-[64px] items-center border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 md:h-[76px] lg:px-8">
    <div className="flex min-w-0 flex-1 items-center gap-3"><button onClick={onMenu} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft-blue hover:text-navy md:hidden" aria-label="Open navigation"><Menu size={20} /></button><div className="relative hidden w-full max-w-[290px] sm:block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><input className="form-field h-10 bg-canvas pl-9 pr-3 text-xs" placeholder={admin ? 'Search users, tasks...' : 'Search tasks...'} /></div></div>
    <div ref={menuRoot} className="relative flex items-center gap-1.5 sm:gap-2" onKeyDown={handleMenuKeyDown}>
      <ClientPreviewBadge />
      <button className="grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-blue hover:text-navy" onClick={() => onToast('Help center is not configured.')} aria-label="Open help center"><HelpCircle size={19} /></button>
      <button ref={notificationTrigger} type="button" onClick={() => toggleMenu('notifications')} className="relative grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-soft-blue hover:text-navy" aria-label={`${unreadCount} unread notifications`} aria-haspopup="menu" aria-expanded={openMenu === 'notifications'}><Bell size={19} />{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-error px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
      <div className="ml-1 h-7 w-px bg-line" />
      <button ref={profileTrigger} type="button" onClick={() => toggleMenu('profile')} className="flex min-h-10 items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-soft-blue" aria-haspopup="menu" aria-expanded={openMenu === 'profile'}><Avatar initials={initials} src={user?.avatar_url} alt={`${userName} profile photo`} size="sm" tone={admin ? 'indigo' : 'navy'} /><span className="hidden max-w-[110px] truncate text-xs font-semibold text-ink sm:block">{userName || '—'}</span><ChevronDown size={14} className="hidden text-subtle sm:block" /></button>
      {openMenu === 'notifications' && <div ref={panelRef} className="topbar-menu topbar-notifications" role="menu" aria-label="Recent notifications">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5"><div><p className="text-sm font-semibold text-ink">Notifications</p><p className="mt-0.5 text-[11px] text-muted">{unreadCount ? `${unreadCount} unread updates` : 'You’re all caught up'}</p></div><span className="grid h-8 w-8 place-items-center rounded-lg bg-soft-blue text-navy"><Bell size={16} /></span></div>
        {unreadCount > 0 && <button type="button" role="menuitem" onClick={() => void markAllRead()} className="flex min-h-10 w-full items-center gap-2 border-b border-line px-4 text-xs font-semibold text-navy transition-colors hover:bg-canvas"><CheckCheck size={14} /> Mark all as read</button>}
        <div className="max-h-[min(55vh,420px)] overflow-y-auto thin-scroll">
          {notifications.length ? notifications.slice(0, 6).map((notification) => <button type="button" role="menuitem" key={notification.id} onClick={() => void selectNotification(notification)} className={`flex min-h-[64px] w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-canvas ${notification.unread ? 'bg-[#F8FAFC]' : ''}`}><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${notification.tone === 'success' ? 'bg-[#ECFDF3] text-success' : notification.tone === 'warning' ? 'bg-[#FFF7ED] text-warning' : 'bg-soft-blue text-navy'}`}>{notification.icon === 'check' ? <CheckCircle2 size={15} /> : notification.icon === 'bookmark' ? <Bookmark size={15} /> : <FileCheck2 size={15} />}</span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-xs font-semibold leading-4 text-ink">{notification.title}</span>{notification.unread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-muted">{notification.body}</span><span className="mt-1 block text-[10px] text-subtle">{notification.time}</span></span></button>) : <div className="px-5 py-8 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-canvas text-subtle"><Bell size={18} /></span><p className="mt-3 text-xs font-semibold text-ink">No notifications yet</p><p className="mt-1 text-[11px] text-muted">Updates about your account will appear here.</p></div>}
        </div>
        <button type="button" role="menuitem" onClick={() => { closeMenu(); onNavigate(admin ? 'admin-notifications' : 'notifications') }} className="flex min-h-11 w-full items-center justify-between px-4 text-xs font-semibold text-navy transition-colors hover:bg-canvas">View all notifications <ChevronRight size={15} /></button>
      </div>}
      {openMenu === 'profile' && <div ref={panelRef} className="topbar-menu topbar-profile" role="menu" aria-label="Profile menu">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5"><Avatar initials={initials} src={user?.avatar_url} alt={`${userName} profile photo`} size="md" tone={admin ? 'indigo' : 'navy'} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{userName || 'Account'}</p><p className="truncate text-[11px] text-muted">{user?.email || (admin ? 'Admin account' : 'Member account')}</p></div></div>
        <div className="p-1.5">{profileLinks.map((link) => <button type="button" role="menuitem" key={link.label} onClick={() => { closeMenu(); if (link.action) link.action(); else if (link.page) onNavigate(link.page) }} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-xs font-medium text-muted transition-colors hover:bg-soft-blue hover:text-navy">{link.label}</button>)}</div>
      </div>}
    </div>
  </header>
}

export function ClientPreviewBadge() {
  if (import.meta.env.VITE_CLIENT_PREVIEW !== 'true') return null
  return <span title="Client Preview environment" aria-label="Client Preview environment" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#D9E2EC] bg-[#EEF3FA] px-2.5 py-1.5 text-[10px] font-semibold text-navy"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#4F6FAE]" /><span className="hidden sm:inline">Client Preview</span><span className="sm:hidden">Preview</span></span>
}

export function CopyButton({ value, onCopied }: { value: string; onCopied?: () => void }) {
  return <button disabled={!value} onClick={async () => { try { if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.'); await navigator.clipboard.writeText(value); onCopied?.() } catch { /* Clipboard denial should not be reported as a successful copy. */ } }} className="btn-secondary min-h-10 shrink-0 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"><Copy size={14} />Copy</button>
}

export function Modal({ open, title, description, onClose, children, size = 'md' }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFrame = window.requestAnimationFrame(() => {
      const first = contentRef.current?.querySelector<HTMLElement>('input, button, textarea, select, [tabindex="0"]')
      if (first) first.focus()
      else contentRef.current?.focus()
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab') return
      const focusable = contentRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')
      if (!focusable?.length) { event.preventDefault(); contentRef.current?.focus(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus()
    }
  }, [open])
  if (!open) return null
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div ref={contentRef} className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-soft sm:rounded-2xl sm:p-6 ${width}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={description ? 'modal-description' : undefined} tabIndex={-1}><div className="flex items-start justify-between gap-4"><div><h2 id="modal-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>{description && <p id="modal-description" className="mt-1 text-xs leading-5 text-muted">{description}</p>}</div><button onClick={onClose} className="btn-ghost -mr-2 -mt-2 min-h-9 px-2 text-muted" aria-label="Close modal"><X size={18} /></button></div><div className="mt-5">{children}</div></div></div>
}

export function TableEmpty({ message }: { message: string }) {
  return <div className="flex items-center justify-center px-4 py-10 text-sm text-muted">{message}</div>
}

export const utilityIcons = { ArrowUpRight, ArrowRight, ChevronRight, Search, Pencil, Tag, Link2, CreditCard, BadgeDollarSign, CircleDollarSign, FileCheck2, BookOpenCheck, Activity, UserCheck, Clock3, Sparkles, ImageIcon }

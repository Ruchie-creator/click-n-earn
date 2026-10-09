import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BellRing,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CircleHelp,
  Clock3,
  Copy,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  Filter,
  Globe2,
  Image as ImageIcon,
  Info,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Mail,
  Megaphone,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import { adminNotifications, adminNotificationStats, adminPayouts, adminReferrals, adminStats, adminTasks, adminTransactions, activity, clearAllData, dashboardStats, hydrateAdminData, hydrateAdminMembers, hydrateAdminNotifications, hydrateAdminPayouts, hydrateAdminReferrals, hydrateAdminSubmissions, hydrateAdminTasks, hydrateAdminTransactions, hydrateDashboardData, hydrateFinanceData, hydrateMarketplaceData, members, notifications, payouts, referrals, reservations, tasks, verificationQueue, type ReservationItem, type Task, type VerificationQueueItem } from './data'
import { api, getToken, setToken, type ApiDemoStatus, type ApiError, type ApiPayoutMethod, type ApiUser } from './api'
import {
  AppPage,
  Avatar,
  CopyButton,
  ClientPreviewBadge,
  EmptyState,
  FileUpload,
  Logo,
  Modal,
  PageHeader,
  Sidebar,
  StatCard,
  StatusBadge,
  TableEmpty,
  TaskCard,
  Toast,
  Topbar,
  formatCurrency,
  type StatusTone,
} from './components'

const memberPages: AppPage[] = ['dashboard', 'tasks', 'my-tasks', 'task-detail', 'proof', 'earnings', 'referrals', 'payouts', 'notifications', 'profile']
const adminPages: AppPage[] = ['admin-dashboard', 'admin-tasks', 'admin-submissions', 'admin-verification', 'admin-payouts', 'admin-users', 'admin-referrals', 'admin-transactions', 'admin-notifications', 'admin-settings']

const pageTitles: Partial<Record<AppPage, string>> = {
  dashboard: 'Dashboard',
  tasks: 'Available tasks',
  'my-tasks': 'My tasks',
  'task-detail': 'Task details',
  proof: 'Submit proof',
  earnings: 'Earnings',
  referrals: 'Referrals',
  payouts: 'Payouts',
  notifications: 'Notifications',
  profile: 'Profile',
  'admin-dashboard': 'Admin dashboard',
  'admin-tasks': 'Task management',
  'admin-submissions': 'Submissions',
  'admin-verification': 'Verification queue',
  'admin-payouts': 'Payout management',
  'admin-users': 'Users',
  'admin-referrals': 'Referral activity',
  'admin-transactions': 'Transactions',
  'admin-notifications': 'Notifications',
  'admin-settings': 'Settings',
}

const getTone = (status: string): StatusTone => {
  const lower = status.toLowerCase()
  if (lower.includes('paid') || lower.includes('success') || lower.includes('approved') || lower.includes('active') || lower.includes('funded')) return 'success'
  if (lower.includes('pending') || lower.includes('review') || lower.includes('reserved') || lower.includes('limited') || lower.includes('progress')) return 'warning'
  if (lower.includes('processing') || lower.includes('accepted') || lower.includes('submitted') || lower.includes('in progress')) return 'processing'
  if (lower.includes('reject') || lower.includes('error') || lower.includes('deactivated')) return 'error'
  return 'neutral'
}

const emptyTask: Task = {
  id: '',
  title: '',
  shortDescription: '',
  description: '',
  category: '',
  image: '',
  productPrice: 0,
  incentive: 0,
  slots: 0,
  status: '',
  sponsor: '',
  instructions: [],
  requirements: [],
}

export default function App() {
  const [page, setPage] = useState<AppPage>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [proofFiles, setProofFiles] = useState<string[]>([])
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null)
  const proofIdempotency = useRef<{ signature: string; key: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()))
  const [authChecking, setAuthChecking] = useState(() => Boolean(getToken()))
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
  const [, setDataVersion] = useState(0)
  const canAccessAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const refreshMemberData = async () => {
    const [dashboard, taskResponse, reservationResponse, notificationResponse, earningsResponse, referralsResponse, payoutsResponse] = await Promise.all([
      api.dashboard(), api.tasks(), api.reservations(), api.notifications(), api.earnings(), api.referrals(), api.payouts(),
    ])
    hydrateMarketplaceData({
      tasks: taskResponse.data.items,
      reservations: reservationResponse.data.items,
      notifications: notificationResponse.data.items,
    })
    hydrateFinanceData({ earnings: earningsResponse.data, referrals: referralsResponse.data, payouts: payoutsResponse.data })
    hydrateDashboardData(dashboard.data.stats, referralsResponse.data.code)
    setSelectedTaskId((current) => tasks.some((task) => task.id === current) ? current : tasks[0]?.id || '')
    setSelectedReservationId((current) => reservations.some((reservation) => reservation.id === current)
      ? current
      : dashboard.data.recent_reservations[0]?.id ?? reservationResponse.data.items[0]?.id ?? null)
    setDataVersion((version) => version + 1)
  }

  const refreshAdminData = async () => {
    const [dashboard, submissionResponse, payoutResponse, taskResponse, userResponse, referralResponse, transactionResponse, notificationResponse] = await Promise.all([
      api.adminDashboard(), api.adminSubmissions(), api.adminPayouts(), api.adminTasks(), api.adminUsers(), api.adminReferrals(), api.adminTransactions(), api.adminNotifications(),
    ])
    hydrateAdminData(dashboard.data.stats, dashboard.data.queues)
    hydrateAdminSubmissions(submissionResponse.data.items)
    hydrateAdminPayouts(payoutResponse.data.items)
    hydrateAdminTasks(taskResponse.data)
    hydrateAdminMembers(userResponse.data.items)
    hydrateAdminReferrals(referralResponse.data.items)
    hydrateAdminTransactions(transactionResponse.data.items)
    hydrateAdminNotifications(notificationResponse.data.items, notificationResponse.data.summary)
    setDataVersion((version) => version + 1)
  }

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!getToken()) return
    api.me()
      .then((response) => {
        setCurrentUser(response.data)
        setAuthenticated(true)
        setAuthChecking(false)
        setPage(response.data.role === 'admin' || response.data.role === 'super_admin' ? 'admin-dashboard' : 'dashboard')
      })
      .catch(() => {
        setToken(null)
        setCurrentUser(null)
        setAuthenticated(false)
        setAuthChecking(false)
        setPage('login')
        setToast('Your session has expired. Please sign in again.')
      })
  }, [])

  useEffect(() => {
    if (!authenticated || !currentUser) return
    void refreshMemberData().catch((error) => setToast(error instanceof Error ? error.message : 'Your account data could not be loaded.'))
    if (canAccessAdmin) void refreshAdminData().catch((error) => setToast(error instanceof Error ? error.message : 'Admin data could not be loaded.'))
  }, [authenticated, canAccessAdmin, currentUser])

  const handleAuthenticated = (user: ApiUser) => {
    clearAllData()
    setCurrentUser(user)
    setAuthenticated(true)
    setAuthChecking(false)
    setPage(user.role === 'admin' || user.role === 'super_admin' ? 'admin-dashboard' : 'dashboard')
  }

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      setToken(null)
    }
    setCurrentUser(null)
    clearAllData()
    setAuthenticated(false)
    setAuthChecking(false)
    setPage('login')
    setToast('You have been signed out.')
  }

  const navigate = (nextPage: AppPage) => {
    if (adminPages.includes(nextPage) && !canAccessAdmin) {
      setToast('You do not have access to the admin workspace.')
      return
    }
    setPage(nextPage)
    setMobileOpen(false)
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? emptyTask
  const selectedReservation = reservations.find((reservation) => reservation.id === selectedReservationId) ?? null
  const reserveSelectedTask = async (): Promise<boolean> => {
    if (!selectedTask.id) {
      setToast('This task is no longer available.')
      return false
    }
    try {
      const response = await api.reserveTask(selectedTask.id)
      setSelectedReservationId(response.data.id)
      await refreshMemberData()
      navigate('proof')
      return true
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'We could not reserve this task.')
      return false
    }
  }
  const submitProof = async (details: { amount: string; date: string; time: string; reference: string; note: string }) => {
    if (!selectedReservationId || !proofFile) {
      setToast('Reserve the task and add a proof file first.')
      return
    }
    const signature = [selectedReservationId, proofFile.name, proofFile.size, proofFile.lastModified, details.amount, details.date, details.time, details.reference, details.note].join('|')
    const key = proofIdempotency.current?.signature === signature ? proofIdempotency.current.key : window.crypto.randomUUID()
    proofIdempotency.current = { signature, key }
    try {
      await api.submitProof(selectedReservationId, { file: proofFile, purchaseAmount: details.amount, purchaseDate: details.date, purchaseTime: details.time, reference: details.reference, note: details.note, idempotencyKey: key })
      proofIdempotency.current = null
      setProofFile(null)
      setProofFiles([])
      await refreshMemberData()
      setToast('Proof submitted. We’ll notify you when it’s reviewed.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'We could not submit your proof.')
    }
  }
  const showAppShell = memberPages.includes(page) || adminPages.includes(page)
  const admin = adminPages.includes(page)

  if (authChecking) return <div className="grid min-h-screen place-items-center bg-canvas text-sm font-medium text-muted">Checking your session…</div>
  if (page === 'landing') return <LandingPage onNavigate={navigate} />
  if (page === 'how') return <HowPage onNavigate={navigate} />
  if (page === 'login' || page === 'register' || page === 'forgot') return <><AuthPage mode={page} onNavigate={navigate} onToast={setToast} onAuthenticated={handleAuthenticated} /><>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</></>
  if (showAppShell && !authenticated) return <><AuthPage mode="login" onNavigate={navigate} onToast={setToast} onAuthenticated={handleAuthenticated} /><>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</></>
  if (!showAppShell) return null

  return (
    <div className="app-shell">
      <Sidebar admin={admin} page={page} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onSwitchMode={() => navigate(admin ? 'dashboard' : 'admin-dashboard')} canAccessAdmin={canAccessAdmin} onLogout={() => void handleLogout()} unreadCount={admin ? Number(adminNotificationStats.unreadInApp) || 0 : notifications.filter((item) => item.unread).length} reviewCount={Number(adminStats.pendingVerification) || 0} />
      <div className="min-h-screen md:pl-[264px]">
          <Topbar admin={admin} userName={currentUser?.name || ''} unreadCount={admin ? Number(adminNotificationStats.unreadInApp) || 0 : notifications.filter((item) => item.unread).length} onMenu={() => setMobileOpen(true)} onNavigate={navigate} onToast={setToast} />
        <main className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          {admin ? <AdminRoutes page={page} onNavigate={navigate} onToast={setToast} onRefresh={refreshAdminData} /> : <MemberRoutes page={page} userName={currentUser?.name || ''} currentUser={currentUser} onUserUpdated={setCurrentUser} selectedTask={selectedTask} selectedReservation={selectedReservation} onNavigate={navigate} onSelectTask={(task) => { setSelectedTaskId(task.id); navigate('task-detail') }} onChooseReservation={(id) => { setSelectedReservationId(id); navigate('proof') }} proofFiles={proofFiles} setProofFiles={setProofFiles} onProofFile={setProofFile} onReserve={reserveSelectedTask} onSubmitProof={submitProof} onToast={setToast} onRefresh={refreshMemberData} />}
        </main>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

function MemberRoutes({ page, userName, currentUser, onUserUpdated, selectedTask, selectedReservation, onNavigate, onSelectTask, onChooseReservation, proofFiles, setProofFiles, onProofFile, onReserve, onSubmitProof, onToast, onRefresh }: { page: AppPage; userName: string; currentUser: ApiUser | null; onUserUpdated: (user: ApiUser) => void; selectedTask: Task; selectedReservation: ReservationItem | null; onNavigate: (page: AppPage) => void; onSelectTask: (task: Task) => void; onChooseReservation: (id: number) => void; proofFiles: string[]; setProofFiles: (files: string[]) => void; onProofFile: (file: File | null) => void; onReserve: () => Promise<boolean>; onSubmitProof: (details: { amount: string; date: string; time: string; reference: string; note: string }) => void; onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  if (page === 'dashboard') return <DashboardPage userName={userName} onNavigate={onNavigate} onSelectTask={onSelectTask} />
  if (page === 'tasks') return <TasksPage onSelectTask={onSelectTask} />
  if (page === 'my-tasks') return <MyTasksPage onNavigate={onNavigate} onChooseReservation={onChooseReservation} />
  if (page === 'task-detail') return <TaskDetailPage task={selectedTask} onBack={() => onNavigate('tasks')} onReserve={onReserve} />
  if (page === 'proof') return selectedReservation
    ? <ProofPage key={selectedReservation.id} reservation={selectedReservation} files={proofFiles} setFiles={setProofFiles} onProofFile={onProofFile} onBack={() => onNavigate('my-tasks')} onSubmit={onSubmitProof} />
    : <EmptyState icon={ClipboardCheck} title="No active reservation selected" description="Choose one of your reserved tasks before submitting proof." action={<button onClick={() => onNavigate('my-tasks')} className="btn-secondary">View my tasks</button>} />
  if (page === 'earnings') return <EarningsPage />
  if (page === 'referrals') return <ReferralsPage onToast={onToast} />
  if (page === 'payouts') return <PayoutsPage onToast={onToast} />
  if (page === 'notifications') return <NotificationsPage onToast={onToast} onRefresh={onRefresh} />
  return <ProfilePage user={currentUser} onUserUpdated={onUserUpdated} onToast={onToast} />
}

function DashboardPage({ userName, onNavigate, onSelectTask }: { userName: string; onNavigate: (page: AppPage) => void; onSelectTask: (task: Task) => void }) {
  const firstName = userName.trim().split(/\s+/)[0] || 'there'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const referralCode = dashboardStats.referralCode
  const invite = () => {
    if (!referralCode) {
      onNavigate('referrals')
      return
    }
    const link = new URL(`/register?ref=${encodeURIComponent(referralCode)}`, window.location.origin).toString()
    void navigator.clipboard?.writeText(link)
  }
  return <div className="space-y-7">
    <PageHeader eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} title={`${greeting}, ${firstName}`} description={`You currently have ${dashboardStats.tasksInProgress} tasks in progress.`} actions={<><button onClick={invite} className="btn-secondary"><UsersRound size={16} /> Invite a friend</button><button onClick={() => onNavigate('tasks')} className="btn-primary"><Sparkles size={16} /> Browse tasks</button></>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Pending earnings" value={dashboardStats.pendingEarnings} helper="Awaiting the next payout step" icon={Clock3} tone="orange" onClick={() => onNavigate('earnings')} />
      <StatCard label="Processing payouts" value={dashboardStats.processingPayouts} helper="Payouts currently in progress" icon={RefreshCw} tone="blue" onClick={() => onNavigate('earnings')} />
      <StatCard label="Paid earnings" value={dashboardStats.paidEarnings} helper="Total paid to date" icon={CircleDollarSign} tone="green" onClick={() => onNavigate('earnings')} />
      <StatCard label="Tasks in progress" value={dashboardStats.tasksInProgress} helper="Your active reservations" icon={ClipboardCheck} tone="navy" onClick={() => onNavigate('my-tasks')} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <section className="card p-5 sm:p-6">
        <p className="eyebrow">Account summary</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Your rewards at a glance</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3"><div><p className="text-[11px] text-muted">Paid out</p><p className="number mt-1 text-sm font-semibold text-navy">{dashboardStats.paidEarnings}</p></div><div><p className="text-[11px] text-muted">Pending</p><p className="number mt-1 text-sm font-semibold text-warning">{dashboardStats.pendingEarnings}</p></div><div><p className="text-[11px] text-muted">Tasks completed</p><p className="number mt-1 text-sm font-semibold text-ink">{dashboardStats.completedTasks}</p></div></div>
      </section>
      <section className="card overflow-hidden bg-navy text-white"><div className="flex items-start justify-between p-5 sm:p-6"><div><p className="eyebrow text-white/50">Referral snapshot</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em]">Invite your network</h2><p className="mt-2 max-w-xs text-xs leading-5 text-white/60">Your referral activity and any eligible rewards are shown here.</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#B9D7FF]"><UsersRound size={19} /></span></div><div className="border-y border-white/10 px-5 py-5 sm:px-6"><div className="flex items-end justify-between gap-3"><div><p className="text-[11px] text-white/50">Referral earnings</p><p className="number mt-1 text-[30px] font-semibold tracking-[-0.05em]">{dashboardStats.referralEarnings}</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">{dashboardStats.successfulReferrals} qualified</span></div><p className="mt-4 text-[11px] text-white/50">{dashboardStats.totalReferrals} referrals recorded</p></div><div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"><span className="truncate text-xs text-white/55">Your code: <span className="font-semibold text-white/85">{referralCode || 'Not available'}</span></span><button onClick={() => onNavigate('referrals')} className="shrink-0 text-xs font-semibold text-[#B9D7FF] hover:text-white">View referrals <ArrowRight className="ml-1 inline" size={13} /></button></div></section>
    </div>
    <section><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Marketplace</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Available tasks</h2></div><button onClick={() => onNavigate('tasks')} className="btn-ghost">View all <ArrowRight size={15} /></button></div>{tasks.length ? <div className="grid gap-4 lg:grid-cols-3">{tasks.slice(0, 3).map((task) => <TaskCard key={task.id} task={task} onView={onSelectTask} />)}</div> : <EmptyState icon={Tag} title="No tasks are available right now." description="Check back soon for new earning opportunities." action={<button onClick={() => onNavigate('tasks')} className="btn-secondary">Browse tasks</button>} />}</section>
    <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6"><div><p className="eyebrow">Your activity</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Recent activity</h2></div><button onClick={() => onNavigate('earnings')} className="btn-ghost">View history <ArrowRight size={15} /></button></div>{activity.length ? <div className="divide-y divide-line">{activity.map((item, index) => <div key={`${item.title}-${item.meta}-${index}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.tone === 'success' ? 'bg-[#ECFDF3] text-success' : item.tone === 'processing' ? 'bg-[#EFF6FF] text-processing' : 'bg-[#FFF7ED] text-warning'}`}>{item.tone === 'success' ? <CheckCircle2 size={17} /> : item.tone === 'processing' ? <FileClock size={17} /> : <Bookmark size={17} />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{item.title}</p><p className="mt-0.5 text-xs text-muted">{item.meta}</p></div></div><div className="flex items-center justify-between gap-4 pl-12 sm:pl-0"><p className={`number text-sm font-semibold ${item.amount.startsWith('+') ? 'text-success' : 'text-navy'}`}>{item.amount}</p><StatusBadge tone={getTone(item.status)} dot>{item.status}</StatusBadge></div></div>)}</div> : <TableEmpty message="No activity yet." />}</section>
  </div>
}

function TasksPage({ onSelectTask }: { onSelectTask: (task: Task) => void }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('Recommended')
  const categories = ['All', ...new Set(tasks.map((task) => task.category).filter(Boolean))]
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.shortDescription} ${task.category}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (category === 'All' || task.category === category)
  })
  if (sort === 'Highest incentive') filteredTasks.sort((a, b) => b.incentive - a.incentive)
  if (sort === 'Most slots') filteredTasks.sort((a, b) => b.slots - a.slots)
  return <div className="space-y-7">
    <PageHeader eyebrow="Marketplace" title="Find your next task" description="Browse funded opportunities, review the task terms, and reserve a slot before purchasing." />
    <section className="card p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-[380px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-field pl-9" placeholder="Search by task or category" /></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="thin-scroll flex gap-1 overflow-x-auto pb-1 sm:pb-0">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors ${category === item ? 'bg-navy text-white' : 'text-muted hover:bg-soft-blue hover:text-navy'}`}>{item}</button>)}</div><div className="hidden h-7 w-px bg-line sm:block" /><label className="flex items-center gap-2 text-xs font-medium text-muted"><SlidersHorizontal size={15} /><select value={sort} onChange={(event) => setSort(event.target.value)} className="h-9 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-4 focus:ring-[#1F3558]/10"><option>Recommended</option><option>Highest incentive</option><option>Most slots</option></select></label></div></div></section>
    <div className="flex items-center justify-between"><p className="text-sm text-muted"><span className="font-semibold text-ink">{filteredTasks.length}</span> opportunities available</p><p className="hidden text-xs text-subtle sm:block">Rewards are reserved while slots are available</p></div>
    {filteredTasks.length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredTasks.map((task) => <TaskCard key={task.id} task={task} onView={onSelectTask} />)}</div> : <EmptyState icon={Search} title={tasks.length ? 'No tasks found' : 'No tasks are available right now.'} description={tasks.length ? 'Try a broader search or clear your category filter.' : 'Check back soon for new earning opportunities.'} action={tasks.length ? <button onClick={() => { setSearch(''); setCategory('All') }} className="btn-secondary">Clear filters</button> : undefined} />}
  </div>
}

function MyTasksPage({ onNavigate, onChooseReservation }: { onNavigate: (page: AppPage) => void; onChooseReservation: (id: number) => void }) {
  const activeReservations = reservations.filter((reservation) => ['reserved', 'proof_submitted', 'under_review', 'changes_requested', 'approved', 'processing'].includes(reservation.status))
  const needsProof = (status: string) => status === 'reserved' || status === 'changes_requested'
  const nextExpiry = activeReservations.map((reservation) => reservation.expiresAt).filter((value): value is string => Boolean(value)).sort()[0]
  const expected = activeReservations.reduce((total, reservation) => total + reservation.expectedPayout, 0)
  return <div className="space-y-7">
    <PageHeader eyebrow="Your workspace" title="My tasks" description="Track your reservations, proof status, and the reward amounts attached to each task." actions={<button onClick={() => onNavigate('tasks')} className="btn-primary"><Plus size={16} /> Browse tasks</button>} />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Active reservations" value={String(activeReservations.length)} helper="Currently in progress" icon={ClipboardCheck} tone="navy" /><StatCard label="Expected payout" value={formatCurrency(expected)} helper="For active reservations" icon={WalletCards} tone="green" /><StatCard label="Next expiry" value={nextExpiry ? new Date(nextExpiry).toLocaleDateString() : '—'} helper={nextExpiry ? new Date(nextExpiry).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'No active deadline'} icon={Clock3} tone="orange" /></div>
    {reservations.length ? <div className="space-y-4">{reservations.map((reservation) => <article key={reservation.id} className="card p-4 sm:p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-3">{reservation.task.image && <img src={reservation.task.image} alt="" className="task-image h-16 w-16 shrink-0 rounded-xl object-cover" />}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold text-ink">{reservation.task.title}</h2><StatusBadge tone={getTone(reservation.statusLabel)} dot>{reservation.statusLabel}</StatusBadge></div><p className="mt-1 text-xs text-muted">Reserved {reservation.reservedAt ? new Date(reservation.reservedAt).toLocaleString() : '—'} · {reservation.task.sponsor}</p><p className="number mt-2 text-sm font-semibold text-navy">Expected payout {formatCurrency(reservation.expectedPayout)}</p></div></div><div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas px-3 py-3 lg:w-[300px]"><div><p className="text-[10px] text-subtle">Reimbursement</p><p className="number mt-1 text-xs font-semibold text-ink">{formatCurrency(reservation.reimbursement)}</p></div><div><p className="text-[10px] text-subtle">Incentive</p><p className="number mt-1 text-xs font-semibold text-success">+{formatCurrency(reservation.incentive)}</p></div><div><p className="text-[10px] text-subtle">Deadline</p><p className="mt-1 text-xs font-semibold text-warning">{reservation.expiresAt ? new Date(reservation.expiresAt).toLocaleDateString() : '—'}</p></div></div><div className="flex shrink-0 gap-2">{needsProof(reservation.status) && <button onClick={() => onChooseReservation(reservation.id)} className="btn-primary flex-1 px-3 text-xs sm:flex-none">{reservation.status === 'changes_requested' ? 'Resubmit proof' : 'Submit proof'}</button>}</div></div></article>)}</div> : <EmptyState icon={ClipboardCheck} title="No tasks reserved yet." description="Browse available opportunities and reserve a slot to get started." action={<button onClick={() => onNavigate('tasks')} className="btn-primary">Browse tasks</button>} />}
  </div>
}

function TaskDetailPage({ task, onBack, onReserve }: { task: Task; onBack: () => void; onReserve: () => Promise<boolean> }) {
  const available = task.status.toLowerCase() === 'available' && task.slots > 0
  const reserve = () => { if (available) void onReserve() }
  return <div className="space-y-7">
    <PageHeader back={onBack} eyebrow="Available task" title={task.title || 'Task details'} description={task.description || 'Task details are unavailable.'} actions={<StatusBadge tone={available ? 'success' : 'neutral'} dot>{task.status || 'Unavailable'} · {task.slots} slots left</StatusBadge>} />
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="card overflow-hidden"><div className="aspect-[2/1] max-h-[350px] overflow-hidden bg-[#E9EEF5]"><img src={task.image} alt="" className="task-image h-full w-full object-cover" /></div><div className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Sponsored by {task.sponsor}</p><p className="mt-1 text-sm font-semibold text-ink">What you’ll do</p></div><span className="rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-navy">{task.category}</span></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-canvas p-4"><p className="text-xs text-muted">Purchase reimbursement</p><p className="number mt-2 text-xl font-semibold tracking-[-0.04em] text-ink">{formatCurrency(task.productPrice)}</p><p className="mt-1 text-[11px] text-subtle">Paid at partner checkout</p></div><div className="rounded-xl bg-[#ECFDF3] p-4"><p className="text-xs text-success">Incentive</p><p className="number mt-2 text-xl font-semibold tracking-[-0.04em] text-success">+{formatCurrency(task.incentive)}</p><p className="mt-1 text-[11px] text-[#54B77A]">For completing the task</p></div><div className="rounded-xl bg-soft-blue p-4"><p className="text-xs text-navy">Expected payout</p><p className="number mt-2 text-xl font-semibold tracking-[-0.04em] text-navy">{formatCurrency(task.productPrice + task.incentive)}</p><p className="mt-1 text-[11px] text-accent">After approval</p></div></div><div className="mt-6 rounded-xl border border-[#C8D8EB] bg-soft-blue p-4"><div className="flex items-start gap-3"><Info size={17} className="mt-0.5 shrink-0 text-navy" /><div><p className="text-sm font-semibold text-navy">How reimbursement works</p><p className="mt-1 text-xs leading-5 text-[#526D96]">You pay the product price at the partner checkout. Once your proof is approved, Click & Earn returns the purchase price plus your incentive in one payout.</p></div></div></div><div className="mt-6"><h2 className="text-sm font-semibold text-ink">Instructions</h2><ol className="mt-3 space-y-3">{task.instructions.map((instruction, index) => <li key={instruction} className="flex gap-3 text-sm leading-6 text-muted"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft-blue text-xs font-semibold text-navy">{index + 1}</span><span>{instruction}</span></li>)}</ol></div><div className="mt-6 border-t border-line pt-6"><h2 className="text-sm font-semibold text-ink">Requirements</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{task.requirements.map((requirement) => <div key={requirement} className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 size={15} className="shrink-0 text-success" />{requirement}</div>)}</div></div></div></section>
      <div className="space-y-5"><section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Before you begin</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Reserve before purchasing</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><ShieldCheck size={19} /></span></div><p className="mt-4 text-xs leading-5 text-muted">The server confirms the available capacity and freezes this task’s reimbursement and incentive when your reservation is created.</p></section><section className="card bg-navy p-5 text-white sm:p-6"><p className="eyebrow text-white/50">Ready to continue?</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em]">Reserve your task slot.</h2><p className="mt-2 text-xs leading-5 text-white/60">You’ll be taken to proof submission after the reservation is confirmed. Partner checkout is available from that page.</p><button disabled={!available} onClick={reserve} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-navy transition-[background-color,transform] duration-200 hover:bg-[#EEF3FA] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50">Reserve task <ArrowRight size={15} /></button></section><section className="card p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF7ED] text-warning"><CircleHelp size={17} /></span><div><p className="text-sm font-semibold text-ink">Need help?</p><p className="mt-1 text-xs leading-5 text-muted">Make sure your proof shows the purchase amount and reference number before you submit.</p></div></div></section></div>
    </div>
  </div>
}

function ProofPage({ reservation, files, setFiles, onProofFile, onBack, onSubmit }: { reservation: ReservationItem; files: string[]; setFiles: (files: string[]) => void; onProofFile: (file: File | null) => void; onBack: () => void; onSubmit: (details: { amount: string; date: string; time: string; reference: string; note: string }) => void }) {
  const task = reservation.task
  const latest = reservation.latestProof
  const [amount, setAmount] = useState(latest?.purchaseAmount ? String(latest.purchaseAmount) : '')
  const [date, setDate] = useState(latest?.purchaseDate || '')
  const [time, setTime] = useState(latest?.purchaseTime || '')
  const [reference, setReference] = useState(latest?.transactionReference || '')
  const [note, setNote] = useState('')
  const canSubmit = reservation.status === 'reserved' || reservation.status === 'changes_requested'
  const hasCurrentFile = files.length > 0
  return <div className="space-y-7">
    <PageHeader back={onBack} eyebrow="Proof submission" title="Show us your purchase" description={`Upload proof for ${task.title}. The expected payout is ${formatCurrency(reservation.expectedPayout)} after approval.`} actions={<StatusBadge tone={getTone(reservation.statusLabel)} dot>{reservation.statusLabel}</StatusBadge>} />
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="card p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-line pb-5">{task.image && <img src={task.image} alt="" className="task-image h-12 w-12 rounded-xl object-cover" />}<div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{task.title}</p><p className="mt-0.5 text-xs text-muted">Expected payout <span className="number font-semibold text-navy">{formatCurrency(reservation.expectedPayout)}</span></p></div><span className="ml-auto hidden rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[11px] font-semibold text-success sm:inline-flex">Reservation #{reservation.id}</span></div>
        <div className="mt-6"><div className="mb-3"><p className="eyebrow">Proof file</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Upload your receipt or confirmation</h2></div>{canSubmit ? <FileUpload files={files} onFilesChange={(selected) => { setFiles(selected); if (!selected.length) onProofFile(null) }} onFilesSelected={(selected) => { onProofFile(selected[0] || null); setFiles(selected[0] ? [selected[0].name] : []) }} /> : <div className="rounded-xl border border-line bg-canvas p-4 text-xs text-muted">{latest ? `Current proof: ${latest.originalFileName}` : 'A proof file has been submitted.'} · Status updates come from the review workflow.</div>}</div>
        {canSubmit && <div className="mt-7 border-t border-line pt-6"><div className="mb-4"><p className="eyebrow">Purchase details</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Details shown on your proof</h2><p className="mt-1 text-xs text-muted">Enter the values from your receipt or purchase confirmation.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">Purchase amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="form-field mt-2" inputMode="decimal" /></label><label className="text-xs font-semibold text-ink">Transaction / reference no.<input required value={reference} onChange={(event) => setReference(event.target.value)} className="form-field mt-2" /></label><label className="text-xs font-semibold text-ink">Purchase date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="form-field mt-2" /></label><label className="text-xs font-semibold text-ink">Purchase time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="form-field mt-2" /></label><label className="text-xs font-semibold text-ink sm:col-span-2">Note for the reviewer<textarea value={note} onChange={(event) => setNote(event.target.value)} className="form-field mt-2 h-20 resize-none py-3" maxLength={1000} /></label></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={onBack} className="btn-secondary">Back to my tasks</button><button onClick={() => { if (hasCurrentFile) onSubmit({ amount, date, time, reference, note }) }} disabled={!hasCurrentFile} className="btn-primary">Submit for review <ArrowRight size={15} /></button></div>{!hasCurrentFile && <p className="mt-3 text-right text-xs text-warning">Add a proof file before submitting.</p>}</div>}
      </section>
      <aside className="space-y-5"><section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Submission status</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">{reservation.statusLabel}</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><FileCheck2 size={19} /></span></div><p className="mt-4 text-xs leading-5 text-muted">Your reservation, proof, and payout status are updated from the Click & Earn review workflow.</p>{reservation.submittedAt && <p className="mt-3 text-xs text-muted">Last submitted {new Date(reservation.submittedAt).toLocaleString()}</p>}{reservation.status === 'changes_requested' && <p className="mt-3 rounded-lg bg-[#FFFBEB] px-3 py-2 text-xs leading-5 text-warning">Please review the latest message from the verification team before resubmitting.</p>}{task.checkoutUrl && canSubmit && <a href={task.checkoutUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-4 w-full">Open partner checkout <ExternalLink size={14} /></a>}</section><section className="card p-5"><p className="eyebrow">Proof checklist</p><div className="mt-3 space-y-3">{['Receipt shows the purchase amount', 'Purchase date is readable', 'Reference number is visible', 'File is not cropped or blurry'].map((item) => <div key={item} className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 size={15} className="text-success" />{item}</div>)}</div></section><section className="rounded-2xl border border-[#C8D8EB] bg-soft-blue p-5"><div className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-navy" /><div><p className="text-xs font-semibold text-navy">Your information is protected</p><p className="mt-1 text-[11px] leading-5 text-[#526D96]">Proof files are stored privately and are available only to their owner and authorized reviewers.</p></div></div></section></aside>
    </div>
  </div>
}

function EarningsPage() {
  return <div className="space-y-7">
    <PageHeader eyebrow="Money overview" title="Earnings" description="Track what’s pending, what’s being processed, and what has already reached your payout method." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Pending earnings" value={dashboardStats.pendingEarnings} helper="Not withdrawable yet" icon={Clock3} tone="orange" /><StatCard label="Processing payouts" value={dashboardStats.processingPayouts} helper="Payouts in progress" icon={RefreshCw} tone="blue" /><StatCard label="Completed payouts" value={dashboardStats.paidEarnings} helper={`${dashboardStats.completedTasks} tasks completed`} icon={CircleCheck} tone="green" /><StatCard label="Referral earnings" value={dashboardStats.referralEarnings} helper={`${dashboardStats.successfulReferrals} qualified referrals`} icon={UsersRound} tone="navy" /></div>
    <section className="flex items-start gap-3 rounded-2xl border border-[#F4D7A6] bg-[#FFFBEB] p-4 sm:p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF1D4] text-warning"><CircleAlert size={18} /></span><p className="text-sm leading-6 text-[#9A5B05]">Pending earnings are not available for payout until the associated proof is approved and processed.</p></section>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">Ledger</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Transaction history</h2></div></div>{activity.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Amount</th></tr></thead><tbody className="divide-y divide-line">{activity.map((item, index) => <tr key={`${item.title}-${item.meta}-${index}`} className="transition-colors hover:bg-canvas"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-soft-blue text-navy"><ReceiptText size={15} /></span><div><p className="text-sm font-semibold text-ink">{item.title}</p><p className="mt-0.5 text-xs text-muted">{item.meta.split(' · ')[0]}</p></div></div></td><td className="px-4 py-4 text-xs text-muted">{item.meta.split(' · ')[1] || '—'}</td><td className="px-4 py-4"><StatusBadge tone={getTone(item.status)} dot>{item.status}</StatusBadge></td><td className={`number px-6 py-4 text-right text-sm font-semibold ${item.amount.startsWith('+') ? 'text-success' : 'text-navy'}`}>{item.amount}</td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{activity.map((item, index) => <div key={`${item.title}-${item.meta}-${index}`} className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-soft-blue text-navy"><ReceiptText size={14} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-ink">{item.title}</p><p className="mt-1 text-[11px] text-muted">{item.meta}</p></div></div><p className={`number shrink-0 text-xs font-semibold ${item.amount.startsWith('+') ? 'text-success' : 'text-navy'}`}>{item.amount}</p></div>)}</div></> : <TableEmpty message="No earnings yet." />}</section>
  </div>
}

function ReferralsPage({ onToast }: { onToast: (message: string) => void }) {
  const referralCode = dashboardStats.referralCode
  const referralLink = referralCode ? new URL(`/register?ref=${encodeURIComponent(referralCode)}`, window.location.origin).toString() : ''
  return <div className="space-y-7">
    <PageHeader eyebrow="Invite & earn" title="Referrals" description="Share your account’s referral link and follow each referral’s actual qualification and reward status." actions={<button disabled={!referralLink} className="btn-primary disabled:opacity-50" onClick={() => { if (referralLink) void navigator.clipboard?.writeText(referralLink).then(() => onToast('Referral link copied to your clipboard.')) }}><Copy size={16} /> Copy referral link</button>} />
    <section className="card overflow-hidden"><div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]"><div className="bg-navy p-5 text-white sm:p-7"><p className="eyebrow text-white/50">Your referral link</p><h2 className="mt-2 max-w-md text-[24px] font-semibold leading-tight tracking-[-0.04em]">Invite people you trust.</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/60">Referral qualification and any applicable reward are recorded in your referral history.</p><div className="mt-6 flex flex-col gap-2 sm:flex-row"><div className="flex min-h-11 min-w-0 flex-1 items-center rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white/75"><Link2 size={15} className="mr-2 shrink-0 text-[#B9D7FF]" /><span className="truncate">{referralLink || 'Referral link unavailable'}</span></div><CopyButton value={referralLink} onCopied={() => onToast('Referral link copied to your clipboard.')} /></div></div><div className="grid grid-cols-2 gap-px bg-line"><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">Total referrals</p><p className="number mt-2 text-[30px] font-semibold tracking-[-0.05em] text-navy">{dashboardStats.totalReferrals}</p><p className="mt-1 text-[11px] text-subtle">Recorded by the platform</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">Qualified referrals</p><p className="number mt-2 text-[30px] font-semibold tracking-[-0.05em] text-success">{dashboardStats.successfulReferrals}</p><p className="mt-1 text-[11px] text-subtle">Current account total</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">Referral earnings</p><p className="number mt-2 text-[30px] font-semibold tracking-[-0.05em] text-navy">{dashboardStats.referralEarnings}</p><p className="mt-1 text-[11px] text-subtle">From recorded referral rewards</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">Your referral code</p><p className="mt-2 truncate text-[20px] font-semibold tracking-[0.05em] text-indigo">{referralCode || 'Not available'}</p><p className="mt-1 text-[11px] text-subtle">Use this code in your invite link</p></div></div></div></section>
    <section className="card overflow-hidden"><div className="border-b border-line px-5 py-4 sm:px-6"><p className="eyebrow">Your network</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Referral history</h2></div>{referrals.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[620px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Joined</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Reward</th></tr></thead><tbody className="divide-y divide-line">{referrals.map((referral) => <tr key={referral.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4"><div className="flex items-center gap-3"><Avatar initials={referral.name.split(' ').map((part) => part[0]).join('')} size="sm" tone="blue" /><p className="text-sm font-semibold text-ink">{referral.name}</p></div></td><td className="px-4 py-4 text-xs text-muted">{referral.joined}</td><td className="px-4 py-4"><StatusBadge tone={getTone(referral.status)} dot>{referral.status}</StatusBadge></td><td className="number px-6 py-4 text-right text-sm font-semibold text-success">{referral.reward ? `+${formatCurrency(referral.reward)}` : '—'}</td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{referrals.map((referral) => <div key={referral.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex items-center gap-3"><Avatar initials={referral.name.split(' ').map((part) => part[0]).join('')} size="sm" tone="blue" /><div><p className="text-xs font-semibold text-ink">{referral.name}</p><p className="mt-1 text-[11px] text-muted">{referral.joined}</p></div></div><div className="text-right"><StatusBadge tone={getTone(referral.status)}>{referral.status}</StatusBadge><p className="number mt-1 text-xs font-semibold text-success">{referral.reward ? `+${formatCurrency(referral.reward)}` : '—'}</p></div></div>)}</div></> : <TableEmpty message="No referrals yet." />}</section>
  </div>
}

function PayoutsPage({ onToast }: { onToast: (message: string) => void }) {
  const [showModal, setShowModal] = useState(false)
  const [methods, setMethods] = useState<ApiPayoutMethod[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType] = useState('bank_account')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let mounted = true
    api.payoutMethods().then((response) => { if (mounted) setMethods(response.data) }).catch((error) => { if (mounted) onToast(error instanceof Error ? error.message : 'Payout methods could not be loaded.') })
    return () => { mounted = false }
  }, [])
  const defaultMethod = methods.find((method) => method.is_default) || methods[0]
  const openMethod = (method?: ApiPayoutMethod) => {
    setEditingId(method?.id || null)
    setAccountHolder(method?.account_holder_name || '')
    setAccountNumber('')
    setAccountType(method?.account_type || 'bank_account')
    setCountry(method?.country || '')
    setCurrency(method?.currency || '')
    setShowModal(true)
  }
  const saveMethod = async () => {
    if (!accountHolder.trim() || accountNumber.trim().length < 4) {
      onToast('Enter the account holder name and account number.')
      return
    }
    setSaving(true)
    try {
      const payload = { provider: 'airwallex', account_holder_name: accountHolder.trim(), account_type: accountType, country: country.toUpperCase(), currency: currency.toUpperCase(), is_default: true, routing_details: {}, account_details: { account_number: accountNumber.trim() } }
      const response = editingId ? await api.updatePayoutMethod(editingId, payload) : await api.savePayoutMethod(payload)
      setMethods((current) => editingId ? current.map((method) => method.id === editingId ? response.data : { ...method, is_default: false }) : [response.data, ...current.map((method) => ({ ...method, is_default: false }))])
      setShowModal(false)
      onToast('Payout details saved securely.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not save your payout method.')
    } finally {
      setSaving(false)
    }
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Get paid" title="Payouts" description="Manage where approved task rewards are sent and review your recorded payout history." actions={<button onClick={() => openMethod()} className="btn-primary"><Plus size={16} /> Add payout method</button>} />
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><section className="card p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="eyebrow">Default method</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">{defaultMethod ? (defaultMethod.provider === 'airwallex' ? 'Bank account via Airwallex' : defaultMethod.provider) : 'No payout method set'}</h2></div>{defaultMethod && <button onClick={() => openMethod(defaultMethod)} className="btn-ghost min-h-9 px-2.5"><Pencil size={14} /> Edit</button>}</div>{defaultMethod ? <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-canvas p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><Smartphone size={18} /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{defaultMethod.masked_account || 'Account details saved'}</p><p className="mt-1 text-[11px] text-muted">{defaultMethod.account_holder_name} · {defaultMethod.country} · {defaultMethod.currency}</p></div><StatusBadge tone={getTone(defaultMethod.status)} dot>{defaultMethod.status.replace(/_/g, ' ')}</StatusBadge></div> : <div className="mt-6 rounded-xl bg-canvas p-4 text-xs leading-5 text-muted">Add a payout method to receive approved rewards.</div>}<div className="mt-5 flex items-start gap-2.5 text-xs leading-5 text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />Payout details are handled by the configured payout provider.</div></section><section className="card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF7ED] text-warning"><Clock3 size={19} /></span><div><p className="eyebrow">Next payout</p>{(() => { const pending = payouts.find((payout) => ['Approved', 'Processing', 'Pending'].includes(payout.status)); return pending ? <><p className="number mt-1 text-[26px] font-semibold tracking-[-0.04em] text-navy">{formatCurrency(pending.amount)}</p><p className="mt-1 text-xs text-muted">{pending.method} · {pending.reference}</p><div className="mt-3"><StatusBadge tone={getTone(pending.status)} dot>{pending.status}</StatusBadge></div></> : <p className="mt-2 text-sm font-medium text-muted">No payout is currently in progress.</p> })()}</div></div></section></div>
    <section className="card overflow-hidden"><div className="border-b border-line px-5 py-4 sm:px-6"><p className="eyebrow">Payout history</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Recorded payouts</h2></div>{payouts.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Payout ID</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Method</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Amount</th></tr></thead><tbody className="divide-y divide-line">{payouts.map((payout) => <tr key={payout.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{payout.id}</td><td className="px-4 py-4 text-xs text-muted">{payout.date}</td><td className="px-4 py-4 text-xs text-muted">{payout.method}</td><td className="px-4 py-4"><StatusBadge tone={getTone(payout.status)} dot>{payout.status}</StatusBadge></td><td className="number px-6 py-4 text-right text-sm font-semibold text-navy">{formatCurrency(payout.amount)}</td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="text-xs font-semibold text-navy">{payout.id}</p><p className="mt-1 text-[11px] text-muted">{payout.date} · {payout.method}</p></div><div className="text-right"><p className="number text-xs font-semibold text-navy">{formatCurrency(payout.amount)}</p><StatusBadge tone={getTone(payout.status)}>{payout.status}</StatusBadge></div></div>)}</div></> : <TableEmpty message="No payouts yet." />}</section>
    <Modal open={showModal} title={editingId ? 'Edit payout method' : 'Add payout method'} description="Account details are submitted to the configured payout provider and are not shown in full here." onClose={() => setShowModal(false)}><div className="space-y-4"><label className="text-xs font-semibold text-ink">Payout method<select className="form-field mt-2" value={accountType} onChange={(event) => setAccountType(event.target.value)}><option value="bank_account">Bank account via Airwallex</option><option value="ach">ACH / Bank transfer</option></select></label><label className="text-xs font-semibold text-ink">Bank account<input required className="form-field mt-2" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} autoComplete="off" /></label><label className="text-xs font-semibold text-ink">Account holder name<input required className="form-field mt-2" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">Country code<input required className="form-field mt-2" value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} maxLength={2} /></label><label className="text-xs font-semibold text-ink">Currency code<input required className="form-field mt-2" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} /></label></div><div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button disabled={saving} onClick={() => void saveMethod()} className="btn-primary disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving...' : 'Save changes'} <Check size={15} /></button></div></div></Modal>
  </div>
}

function NotificationsPage({ onToast, onRefresh }: { onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [filter, setFilter] = useState('All')
  const filtered = notifications.filter((notification) => filter === 'All' || (filter === 'Unread' && notification.unread))
  return <div className="space-y-7"><PageHeader eyebrow="Stay in the loop" title="Notifications" description="Updates about your tasks, proof reviews, payouts and referral rewards." actions={<button disabled={!notifications.some((notification) => notification.unread)} onClick={async () => { try { await api.markAllNotificationsRead(); await onRefresh(); setFilter('All'); onToast('Notifications marked as read.') } catch (error) { onToast(error instanceof Error ? error.message : 'We could not update notifications.') } }} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"><Check size={16} /> Mark all as read</button>} /><section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6"><div className="flex gap-1"><button onClick={() => setFilter('All')} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${filter === 'All' ? 'bg-soft-blue text-navy' : 'text-muted hover:bg-canvas'}`}>All updates</button><button onClick={() => setFilter('Unread')} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${filter === 'Unread' ? 'bg-soft-blue text-navy' : 'text-muted hover:bg-canvas'}`}>Unread <span className="ml-1 text-[10px]">{notifications.filter((notification) => notification.unread).length}</span></button></div></div><div className="divide-y divide-line">{filtered.map((notification) => <div key={notification.id} className={`flex gap-3 px-5 py-5 sm:px-6 ${notification.unread ? 'bg-[#FBFCFE]' : ''}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${notification.tone === 'success' ? 'bg-[#ECFDF3] text-success' : notification.tone === 'processing' ? 'bg-[#EFF6FF] text-processing' : notification.tone === 'warning' ? 'bg-[#FFF7ED] text-warning' : 'bg-[#F0F9FF] text-info'}`}>{notification.icon === 'check' ? <CheckCircle2 size={18} /> : notification.icon === 'file' ? <FileCheck2 size={18} /> : notification.icon === 'users' ? <UsersRound size={18} /> : notification.icon === 'bookmark' ? <Bookmark size={18} /> : <Sparkles size={18} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-ink">{notification.title}</p>{notification.unread && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}</div><span className="text-[11px] text-subtle">{notification.time}</span></div><p className="mt-1 text-xs leading-5 text-muted">{notification.body}</p></div></div>)}</div>{filtered.length === 0 && <TableEmpty message={filter === 'Unread' ? 'No unread notifications.' : 'You’re all caught up.'} />}</section></div>
}

function ProfilePage({ user, onUserUpdated, onToast }: { user: ApiUser | null; onUserUpdated: (user: ApiUser) => void; onToast: (message: string) => void }) {
  const [firstName, setFirstName] = useState(user?.name.trim().split(/\s+/)[0] || '')
  const [lastName, setLastName] = useState(user?.name.trim().split(/\s+/).slice(1).join(' ') || '')
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const names = (user?.name || '').trim().split(/\s+/)
    setFirstName(names.shift() || '')
    setLastName(names.join(' '))
  }, [user])
  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      onToast('Enter both your first and last name.')
      return
    }
    setSaving(true)
    try {
      await api.updateProfile({ name: firstName.trim() + ' ' + lastName.trim() })
      const response = await api.me()
      onUserUpdated(response.data)
      onToast('Profile changes saved.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not save your profile.')
    } finally {
      setSaving(false)
    }
  }
  const savePassword = async () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      onToast('Use at least 8 characters and make both new passwords match.')
      return
    }
    setSaving(true)
    try {
      await api.changePassword({ current_password: currentPassword, password: newPassword, password_confirmation: confirmPassword })
      setShowPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onToast('Password updated successfully.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not update your password.')
    } finally {
      setSaving(false)
    }
  }
  return <div className="space-y-7"><PageHeader eyebrow="Account settings" title="Profile" description="Update the personal details attached to your account and manage your password." actions={<button disabled={saving || !user} onClick={() => void saveProfile()} className="btn-primary disabled:cursor-wait disabled:opacity-60"><Check size={16} /> Save changes</button>} /><div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]"><section className="card p-5 sm:p-6"><p className="eyebrow">Your profile</p><div className="mt-5 flex items-center gap-4"><Avatar initials={(firstName[0] || '') + (lastName[0] || '')} size="lg" /><div><p className="text-base font-semibold text-ink">{user?.name || '—'}</p><p className="mt-1 text-xs text-muted">{user?.account_status?.replace(/_/g, ' ') || 'Account details unavailable'}</p></div></div><div className="mt-7 space-y-4"><label className="text-xs font-semibold text-ink">First name<input className="form-field mt-2" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Last name<input className="form-field mt-2" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Email address<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input className="form-field pl-9" value={user?.email || ''} readOnly /></div></label></div></section><div className="space-y-5"><section className="card p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="eyebrow">Security</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Password & sign-in</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><LockKeyhole size={18} /></span></div><div className="mt-5 flex flex-col gap-3 rounded-xl border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-navy"><KeyRound size={16} /></span><div><p className="text-sm font-semibold text-ink">Password</p><p className="mt-0.5 text-xs text-muted">Update it securely from this page</p></div></div><button onClick={() => setShowPassword(true)} className="btn-secondary min-h-9 px-3 text-xs">Change password</button></div></section></div></div><Modal open={showPassword} title="Change password" description="Use a strong password you do not reuse elsewhere." onClose={() => setShowPassword(false)}><div className="space-y-4"><label className="text-xs font-semibold text-ink">Current password<input className="form-field mt-2" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="text-xs font-semibold text-ink">New password<input className="form-field mt-2" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Confirm new password<input className="form-field mt-2" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button onClick={() => setShowPassword(false)} className="btn-secondary">Cancel</button><button disabled={saving} onClick={() => void savePassword()} className="btn-primary disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving...' : 'Update password'} <Check size={15} /></button></div></div></Modal></div>
}

function AdminRoutes({ page, onNavigate, onToast, onRefresh }: { page: AppPage; onNavigate: (page: AppPage) => void; onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  if (page === 'admin-dashboard') return <AdminDashboardPage onNavigate={onNavigate} />
  if (page === 'admin-tasks') return <AdminTasksPage onToast={onToast} onRefresh={onRefresh} />
  if (page === 'admin-verification' || page === 'admin-submissions') return <AdminVerificationPage onToast={onToast} onRefresh={onRefresh} />
  if (page === 'admin-payouts') return <AdminPayoutsPage onToast={onToast} onRefresh={onRefresh} />
  return <AdminGenericPage page={page} onToast={onToast} />
}

function AdminDashboardPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const changesRequested = verificationQueue.filter((item) => item.status === 'changes_requested').length
  return <div className="space-y-7">
    <PageHeader eyebrow="Operations overview" title="Admin dashboard" description="A focused view of Click & Earn’s task funding, verification queue, and payout health." actions={<button onClick={() => onNavigate('admin-tasks')} className="btn-primary"><Plus size={16} /> Create task</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Active tasks" value={adminStats.activeTasks} helper="Currently available" icon={Tag} tone="navy" onClick={() => onNavigate('admin-tasks')} /><StatCard label="Pending verification" value={adminStats.pendingVerification} helper="Open review queue" icon={FileClock} tone="orange" onClick={() => onNavigate('admin-verification')} /><StatCard label="Approved payouts" value={adminStats.approvedPayouts} helper="Awaiting processing" icon={WalletCards} tone="blue" onClick={() => onNavigate('admin-payouts')} /><StatCard label="Reserved rewards" value={adminStats.reservedRewards} helper="Current ledger total" icon={Bookmark} tone="navy" /><StatCard label="Total paid" value={adminStats.totalPaid} helper="Recorded paid payouts" icon={CircleDollarSign} tone="green" /><StatCard label="Active users" value={adminStats.activeUsers} helper="Accounts in active status" icon={UsersRound} tone="blue" /></div>
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]"><section className="card p-5 sm:p-6"><p className="eyebrow">Financial overview</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Payout totals</h2><div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3"><div><p className="text-[11px] text-muted">Approved</p><p className="number mt-1 text-sm font-semibold text-navy">{adminStats.approvedPayouts}</p></div><div><p className="text-[11px] text-muted">Processing</p><p className="number mt-1 text-sm font-semibold text-processing">{adminStats.processingPayouts}</p></div><div><p className="text-[11px] text-muted">Paid</p><p className="number mt-1 text-sm font-semibold text-success">{adminStats.totalPaid}</p></div></div></section><section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Current queue</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Review status</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><BarChart3 size={19} /></span></div><div className="mt-6 space-y-3"><div className="flex justify-between text-xs"><span className="text-muted">Awaiting review</span><span className="font-semibold text-ink">{adminStats.pendingVerification}</span></div><div className="flex justify-between text-xs"><span className="text-muted">Changes requested in loaded queue</span><span className="font-semibold text-warning">{changesRequested}</span></div><div className="flex justify-between text-xs"><span className="text-muted">Items in loaded queue</span><span className="font-semibold text-ink">{verificationQueue.length}</span></div></div></section></div>
    <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6"><div><p className="eyebrow">Requires attention</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Verification queue</h2></div><button onClick={() => onNavigate('admin-verification')} className="btn-ghost">Open queue <ArrowRight size={15} /></button></div>{verificationQueue.length ? <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[780px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Submission</th><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Task</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-6 py-3 text-right font-semibold">Confidence</th></tr></thead><tbody className="divide-y divide-line">{verificationQueue.slice(0, 3).map((item) => <tr key={item.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{item.id}</td><td className="px-4 py-4 text-sm font-medium text-ink">{item.member}</td><td className="px-4 py-4 text-xs text-muted">{item.task}</td><td className="px-4 py-4 text-xs text-muted">{item.submitted}</td><td className="px-6 py-4 text-right"><StatusBadge tone={item.confidence === 'High' ? 'success' : 'warning'} dot>{item.confidence}</StatusBadge></td></tr>)}</tbody></table></div> : <TableEmpty message="No submissions are waiting for review." />}</section>
  </div>
}

function AdminTasksPage({ onToast, onRefresh }: { onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = adminTasks.filter((task) => `${task.title} ${task.category}`.toLowerCase().includes(query.toLowerCase()))
  const createTask = async (payload: Record<string, unknown>) => {
    try {
      await api.adminCreateTask(payload)
      await onRefresh()
      setShowModal(false)
      onToast('Task created and saved.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not create this task.')
    }
  }
  const changeTaskStatus = async (task: Task) => {
    try {
      const status = task.status.toLowerCase() === 'available' ? 'paused' : 'available'
      await api.adminChangeTaskStatus(task.id, status)
      await onRefresh()
      onToast(`Task ${status === 'paused' ? 'paused' : 'made available'}.`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not update this task.')
    }
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Marketplace configuration" title="Task management" description="Fund new purchase opportunities, shape the member experience, and keep reward economics clear." actions={<button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Create task</button>} />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Available tasks" value={adminStats.activeTasks} helper="Current catalog" icon={Tag} tone="navy" /><StatCard label="Reserved slots" value={adminStats.reservedSlots} helper="Current capacity in use" icon={Bookmark} tone="blue" /><StatCard label="Reserved rewards" value={adminStats.reservedRewards} helper="Current ledger total" icon={Banknote} tone="green" /></div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">All opportunities</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Task catalog</h2></div><div className="relative w-full sm:max-w-[260px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="form-field h-9 pl-9 text-xs" placeholder="Search tasks" /></div></div>{filtered.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Task</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Economics</th><th className="px-4 py-3 font-semibold">Slots</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((task) => <tr key={task.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4"><div className="flex items-center gap-3">{task.image && <img src={task.image} alt="" className="task-image h-10 w-10 rounded-lg object-cover" />}<div><p className="text-sm font-semibold text-ink">{task.title}</p><p className="mt-0.5 text-[11px] text-muted">{task.sponsor}</p></div></div></td><td className="px-4 py-4"><span className="rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-navy">{task.category}</span></td><td className="px-4 py-4"><p className="number text-xs font-semibold text-ink">{formatCurrency(task.productPrice)} <span className="font-normal text-muted">+ {formatCurrency(task.incentive)}</span></p><p className="mt-1 text-[10px] text-subtle">{formatCurrency(task.productPrice + task.incentive)} total</p></td><td className="px-4 py-4 text-xs font-semibold text-ink">{task.slots}</td><td className="px-4 py-4"><StatusBadge tone={getTone(task.status)} dot>{task.status}</StatusBadge></td><td className="px-6 py-4 text-right"><button onClick={() => void changeTaskStatus(task)} className="btn-secondary min-h-9 px-2.5 text-xs">{task.status.toLowerCase() === 'available' ? 'Pause task' : 'Make available'}</button></td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{filtered.map((task) => <div key={task.id} className="flex items-start gap-3 px-5 py-4">{task.image && <img src={task.image} alt="" className="task-image h-12 w-12 shrink-0 rounded-lg object-cover" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-semibold text-ink">{task.title}</p><StatusBadge tone={getTone(task.status)}>{task.status}</StatusBadge></div><p className="mt-1 text-[11px] text-muted">{task.category} · {task.slots} slots · <span className="number font-semibold text-navy">{formatCurrency(task.productPrice + task.incentive)}</span></p></div><button onClick={() => void changeTaskStatus(task)} className="btn-secondary min-h-8 px-2 text-[11px]">{task.status.toLowerCase() === 'available' ? 'Pause' : 'Make available'}</button></div>)}</div></> : <TableEmpty message={adminTasks.length ? 'No tasks match your search.' : 'No tasks have been created yet.'} />}</section>
    <Modal open={showModal} title="Create a task" description="Set the economics and checkout details for a new funded opportunity." onClose={() => setShowModal(false)} size="lg"><CreateTaskForm onCancel={() => setShowModal(false)} onCreate={createTask} /></Modal>
  </div>
}

function CreateTaskForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (payload: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [slots, setSlots] = useState('')
  const [price, setPrice] = useState('')
  const [incentive, setIncentive] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const validEconomics = Number(price) > 0 && Number.isFinite(Number(price)) && Number(incentive) >= 0 && Number.isFinite(Number(incentive)) && Number(slots) >= 1 && Number.isInteger(Number(slots))
  const payout = validEconomics ? Number(price) + Number(incentive) : null
  const submit = () => {
    if (!title.trim() || !instructions.trim() || !category || !validEconomics) return
    void onCreate({ title: title.trim(), category, description: instructions.trim(), reimbursement_amount: Number(price), incentive_amount: Number(incentive), available_slots: Number(slots), external_checkout_url: checkoutUrl.trim() || null, instructions: [instructions.trim()], proof_requirements: ['Upload a readable receipt', 'Include the transaction reference'], status: 'paused' })
  }
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink sm:col-span-2">Task title<input required className="form-field mt-2" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Category<select required className="form-field mt-2" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Select a category</option><option>Growth</option><option>Learning</option><option>Finance</option><option>Productivity</option></select></label><label className="text-xs font-semibold text-ink">Available slots<input required min="1" step="1" className="form-field mt-2" type="number" value={slots} onChange={(event) => setSlots(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Product reimbursement<input required min="0.01" step="0.01" className="form-field mt-2" type="number" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" /></label><label className="text-xs font-semibold text-ink">Incentive<input required min="0" step="0.01" className="form-field mt-2" type="number" value={incentive} onChange={(event) => setIncentive(event.target.value)} inputMode="decimal" /></label><div className="sm:col-span-2 rounded-xl border border-[#C8D8EB] bg-soft-blue p-4"><p className="text-xs font-semibold text-navy">Expected payout</p><p className="number mt-1 text-2xl font-semibold tracking-[-0.04em] text-navy">{payout === null ? '—' : formatCurrency(payout)}</p><p className="mt-1 text-[11px] text-[#526D96]">Calculated from the reimbursement and incentive values entered above.</p></div><label className="text-xs font-semibold text-ink sm:col-span-2">External checkout URL<div className="relative mt-2"><Link2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input className="form-field pl-9" value={checkoutUrl} onChange={(event) => setCheckoutUrl(event.target.value)} /></div></label><label className="text-xs font-semibold text-ink sm:col-span-2">Task instructions<textarea required className="form-field mt-2 h-24 resize-none py-3" value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label></div><div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end"><button onClick={onCancel} className="btn-secondary">Cancel</button><button disabled={!title.trim() || !instructions.trim() || !category || !validEconomics} onClick={submit} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">Create draft <ArrowRight size={15} /></button></div></div>
}

function AdminVerificationPage({ onToast, onRefresh }: { onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [selectedId, setSelectedSelectionId] = useState<string | null>(null)
  const selected = verificationQueue.find((item) => item.id === selectedId)
  const [busy, setBusy] = useState(false)
  const downloadProof = async (item: VerificationQueueItem) => {
    if (!item.backendId) return
    try {
      const blob = await api.downloadAdminSubmission(item.backendId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.proof
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The proof file could not be downloaded.')
    }
  }
  const openSubmission = async (item: VerificationQueueItem) => {
    setSelectedSelectionId(item.id)
    if (!item.backendId || item.status !== 'proof_submitted') return
    try {
      await api.reviewSubmission(item.backendId)
      await onRefresh()
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not start this review.')
    }
  }
  const handleDecision = async (decision: 'Approved' | 'Request changes' | 'Rejected', reason: string) => {
    if (!selected?.backendId) {
      onToast('This preview item is not connected to a backend submission.')
      return
    }
    if (decision !== 'Approved' && !reason.trim()) {
      onToast('Add a reviewer note before requesting changes or rejecting proof.')
      return
    }
    setBusy(true)
    try {
      if (decision === 'Approved') await api.approveSubmission(selected.backendId)
      if (decision === 'Request changes') await api.requestSubmissionChanges(selected.backendId, reason.trim())
      if (decision === 'Rejected') await api.rejectSubmission(selected.backendId, reason.trim())
      await onRefresh()
      setSelectedSelectionId(null)
      onToast(selected.id + ' marked ' + decision.toLowerCase() + '.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not update this submission.')
    } finally {
      setBusy(false)
    }
  }
  const setSelectedId = (id: string | null) => {
    if (id === null) {
      setSelectedSelectionId(null)
      return
    }
    const item = verificationQueue.find((entry) => entry.id === id)
    if (item) void openSubmission(item)
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Proof operations" title="Verification queue" description="Review submitted proof, compare it against the server-recorded task economics, and make a clear decision." />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Needs review" value={adminStats.pendingVerification} helper="Current platform total" icon={FileClock} tone="orange" /><StatCard label="High confidence" value={String(verificationQueue.filter((item) => item.confidence === 'High').length)} helper="In the loaded queue" icon={ShieldCheck} tone="green" /><StatCard label="Flagged submissions" value={String(verificationQueue.filter((item) => item.warnings.length > 0).length)} helper="In the loaded queue" icon={ShieldAlert} tone="blue" /></div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">Incoming proof</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Submissions to review</h2></div></div>{verificationQueue.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Submission</th><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Task</th><th className="px-4 py-3 font-semibold">Purchase</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Confidence</th><th className="px-6 py-3 text-right font-semibold">Review</th></tr></thead><tbody className="divide-y divide-line">{verificationQueue.map((item) => <tr key={item.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{item.id}</td><td className="px-4 py-4"><div className="flex items-center gap-2.5"><Avatar initials={item.member.split(' ').map((part) => part[0]).join('')} size="sm" tone="blue" /><span className="text-sm font-medium text-ink">{item.member}</span></div></td><td className="px-4 py-4 text-xs text-muted">{item.task}</td><td className="number px-4 py-4 text-xs font-semibold text-ink">{formatCurrency(item.amount)}</td><td className="px-4 py-4 text-xs text-muted">{item.submitted}</td><td className="px-4 py-4"><StatusBadge tone={item.confidence === 'High' ? 'success' : 'warning'} dot>{item.confidence}</StatusBadge></td><td className="px-6 py-4 text-right"><button onClick={() => setSelectedId(item.id)} className="btn-primary min-h-9 px-3 text-xs">Review <ArrowUpRight size={13} /></button></td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{verificationQueue.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-canvas"><Avatar initials={item.member.split(' ').map((part) => part[0]).join('')} size="sm" tone="blue" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-semibold text-ink">{item.member}</p><StatusBadge tone={item.confidence === 'High' ? 'success' : 'warning'}>{item.confidence}</StatusBadge></div><p className="mt-1 truncate text-[11px] text-muted">{item.task} · {item.submitted}</p></div><ChevronRight size={16} className="text-subtle" /></button>)}</div></> : <TableEmpty message="No submissions are waiting for review." />}</section>
    <Modal open={Boolean(selected)} title={selected ? `Review ${selected.id}` : ''} description={selected ? `${selected.member} · ${selected.task}` : undefined} onClose={() => setSelectedId(null)} size="lg">{selected && <ReviewSubmission item={selected} busy={busy} onDownload={() => void downloadProof(selected)} onDecision={handleDecision} />}</Modal>
  </div>
}

function ReviewSubmission({ item, busy, onDownload, onDecision }: { item: VerificationQueueItem; busy: boolean; onDownload: () => void; onDecision: (decision: 'Approved' | 'Request changes' | 'Rejected', reason: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl bg-navy p-4 text-white">
        <div className="flex aspect-[4/5] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-[#B9D7FF]"><ImageIcon size={24} /></span>
          <p className="mt-4 text-sm font-semibold">{item.proof}</p>
          <p className="mt-1 text-xs text-white/45">Private proof file</p>
          <button onClick={onDownload} className="mt-5 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"><Download size={13} /> Download proof</button>
        </div>
      </div>
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-canvas p-3.5"><p className="text-[11px] text-muted">Detected amount</p><p className="number mt-1 text-lg font-semibold text-ink">{item.detectedAmount === null || item.detectedAmount === undefined ? '—' : formatCurrency(item.detectedAmount)}</p><p className="mt-1 text-[10px] text-muted">Declared {formatCurrency(item.amount)}</p></div>
          <div className="rounded-xl border border-line bg-canvas p-3.5"><p className="text-[11px] text-muted">Expected payout</p><p className="number mt-1 text-lg font-semibold text-navy">{formatCurrency(item.expectedPayout)}</p><p className="mt-1 text-[10px] text-muted">Reimbursement + incentive</p></div>
          <div className="rounded-xl border border-line bg-canvas p-3.5"><p className="text-[11px] text-muted">Amount check</p><p className={`mt-1 text-lg font-semibold ${item.amountMatches === true ? 'text-success' : item.amountMatches === false ? 'text-error' : 'text-muted'}`}>{item.amountMatches === true ? 'Match' : item.amountMatches === false ? 'Mismatch' : 'Not checked'}</p><p className="mt-1 text-[10px] text-muted">Reimbursement {formatCurrency(item.reimbursement)}</p></div>
        </div>
        <div className="mt-4 divide-y divide-line rounded-xl border border-line">
          <div className="flex items-center justify-between px-4 py-3"><span className="text-xs text-muted">Purchase date & time</span><span className="text-right text-xs font-semibold text-ink">{item.purchaseDate || '—'}{item.purchaseTime ? ` · ${item.purchaseTime}` : ''}</span></div>
          <div className="flex items-center justify-between px-4 py-3"><span className="text-xs text-muted">Reference number</span><span className="text-xs font-semibold text-ink">{item.transactionReference || '—'}</span></div>
          <div className="flex items-center justify-between px-4 py-3"><span className="text-xs text-muted">Reimbursement / incentive</span><span className="text-xs font-semibold text-ink">{formatCurrency(item.reimbursement)} / {formatCurrency(item.incentive)}</span></div>
          <div className="flex items-center justify-between px-4 py-3"><span className="text-xs text-muted">Automation confidence</span><StatusBadge tone={item.confidence === 'High' ? 'success' : 'warning'} dot>{item.confidence}</StatusBadge></div>
        </div>
        {(item.warnings.length > 0 || item.userNote) && <div className="mt-4 rounded-xl border border-[#F4D7A6] bg-[#FFFBEB] p-3.5 text-xs leading-5 text-[#9A5B05]">{item.warnings.map((warning) => <p key={warning}>{warning}</p>)}{item.userNote && <p className={item.warnings.length ? 'mt-2 border-t border-[#F4D7A6] pt-2' : ''}>Member note: {item.userNote}</p>}</div>}
        <label className="mt-4 block text-xs font-semibold text-ink">Reviewer note <textarea className="form-field mt-2 h-20 resize-none py-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an optional note for the member..." /></label>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button disabled={busy} onClick={() => void onDecision('Approved', note)} className="btn-primary bg-success hover:bg-[#12863C] disabled:cursor-wait disabled:opacity-60"><Check size={15} /> Approve</button>
          <button disabled={busy} onClick={() => void onDecision('Request changes', note)} className="btn-secondary border-[#F4D7A6] text-warning hover:bg-[#FFFBEB] disabled:cursor-wait disabled:opacity-60"><RefreshCw size={15} /> Request changes</button>
          <button disabled={busy} onClick={() => void onDecision('Rejected', note)} className="btn-secondary border-[#F4B7B7] text-error hover:bg-[#FEF2F2] disabled:cursor-wait disabled:opacity-60"><X size={15} /> Reject</button>
        </div>
      </div>
    </div>
  )
}

function AdminPayoutsPage({ onToast, onRefresh }: { onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [filter, setFilter] = useState('All')
  const rows = adminPayouts
  const filtered = filter === 'All' ? rows : rows.filter((row) => row.status === filter)
  const updateStatus = async (id: string, action: 'process' | 'paid' | 'retry') => {
    const row = rows.find((item) => item.id === id)
    if (!row?.backendId) {
      onToast('This payout is not connected to a backend record.')
      return
    }
    const manualReference = action === 'paid' ? window.prompt('Enter the confirmed payout reference. Only mark a payout paid after the transfer is confirmed.')?.trim() : undefined
    if (action === 'paid' && !manualReference) return
    try {
      if (action === 'retry') {
        await api.retryPayout(row.backendId)
        await onRefresh()
        onToast(id + ' retry queued.')
        return
      }
      const response = action === 'process'
        ? await api.processPayout(row.backendId)
        : await api.markPayoutPaid(row.backendId, manualReference!, 'Manually reconciled by an authorized administrator.')
      const actualStatus = response.data.status.charAt(0).toUpperCase() + response.data.status.slice(1)
      await onRefresh()
      onToast(id + ' marked ' + actualStatus.toLowerCase() + '.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not update ' + id + '.')
    }
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Money operations" title="Payout management" description="Move approved rewards through processing and keep a clear record of recorded payouts." />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Approved payouts" value={adminStats.approvedPayouts} helper="Currently approved" icon={Clock3} tone="orange" /><StatCard label="Processing" value={adminStats.processingPayouts} helper="Currently in progress" icon={RefreshCw} tone="blue" /><StatCard label="Total paid" value={adminStats.totalPaid} helper="Recorded paid payouts" icon={CircleDollarSign} tone="green" /></div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">Payout ledger</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Approved rewards</h2></div><div className="thin-scroll flex gap-1 overflow-x-auto">{['All', 'Approved', 'Processing', 'Paid', 'Failed'].map((item) => <button key={item} onClick={() => setFilter(item)} className={'min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold ' + (filter === item ? 'bg-soft-blue text-navy' : 'text-muted hover:bg-canvas')}>{item}</button>)}</div></div>
    {filtered.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Payout</th><th className="px-4 py-3 font-semibold">Member / task</th><th className="px-4 py-3 font-semibold">Reimbursement</th><th className="px-4 py-3 font-semibold">Incentive</th><th className="px-4 py-3 font-semibold">Total</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((row) => <tr key={row.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{row.id}<p className="mt-1 font-normal text-subtle">{row.date}</p></td><td className="px-4 py-4"><p className="text-sm font-semibold text-ink">{row.member}</p><p className="mt-1 text-[11px] text-muted">{row.task}</p></td><td className="number px-4 py-4 text-xs text-ink">{formatCurrency(row.reimbursement)}</td><td className="number px-4 py-4 text-xs text-success">+{formatCurrency(row.incentive)}</td><td className="number px-4 py-4 text-sm font-semibold text-navy">{formatCurrency(row.total)}</td><td className="px-4 py-4"><StatusBadge tone={getTone(row.status)} dot>{row.status}</StatusBadge></td><td className="px-6 py-4 text-right">{row.status === 'Approved' ? <button onClick={() => void updateStatus(row.id, 'process')} className="btn-primary min-h-9 px-3 text-xs">Process payout</button> : row.status === 'Processing' ? <button onClick={() => void updateStatus(row.id, 'paid')} className="btn-secondary min-h-9 px-3 text-xs">Mark paid</button> : row.status === 'Failed' || row.status === 'Payout Failed' ? <button onClick={() => void updateStatus(row.id, 'retry')} className="btn-secondary min-h-9 px-3 text-xs">Retry</button> : <button onClick={() => onToast(row.reference === '—' ? 'No provider reference is recorded.' : `${row.id} · ${row.reference}`)} className="btn-ghost min-h-9 px-2.5 text-xs">View reference</button>}</td></tr>)}</tbody></table></div>
    <div className="divide-y divide-line md:hidden">{filtered.map((row) => <div key={row.id} className="space-y-3 px-5 py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-navy">{row.id}</p><p className="mt-1 text-sm font-semibold text-ink">{row.member}</p><p className="mt-1 text-[11px] text-muted">{row.task} · {row.date}</p></div><StatusBadge tone={getTone(row.status)}>{row.status}</StatusBadge></div><div className="flex items-center justify-between border-t border-line pt-3"><p className="number text-sm font-semibold text-navy">{formatCurrency(row.total)} <span className="text-[11px] font-normal text-muted">total</span></p>{row.status === 'Approved' ? <button onClick={() => void updateStatus(row.id, 'process')} className="btn-primary min-h-9 px-3 text-xs">Process</button> : row.status === 'Processing' ? <button onClick={() => void updateStatus(row.id, 'paid')} className="btn-secondary min-h-9 px-3 text-xs">Mark paid</button> : row.status === 'Failed' || row.status === 'Payout Failed' ? <button onClick={() => void updateStatus(row.id, 'retry')} className="btn-secondary min-h-9 px-3 text-xs">Retry</button> : <button onClick={() => onToast(row.reference === '—' ? 'No provider reference is recorded.' : `${row.id} · ${row.reference}`)} className="btn-ghost min-h-9 px-2 text-xs">Reference</button>}</div></div>)}</div></> : <TableEmpty message={rows.length ? 'No payouts match this status.' : 'No payouts yet.'} />}</section>
  </div>
}

function AdminGenericPage({ page, onToast }: { page: AppPage; onToast: (message: string) => void }) {
  if (page === 'admin-users') return <AdminUsersPage />
  if (page === 'admin-referrals') return <AdminReferralsPage />
  if (page === 'admin-transactions') return <AdminTransactionsPage />
  if (page === 'admin-notifications') return <AdminNotificationsPage />
  return <><AdminSettingsPage onToast={onToast} />{import.meta.env.VITE_CLIENT_PREVIEW === 'true' && <DemoDataPanel onToast={onToast} />}</>
}

function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const filtered = members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase()))
  const activeCount = members.filter((member) => member.status.toLowerCase() === 'active').length
  return <div className="space-y-7"><PageHeader eyebrow="Member management" title="Users" description="Review member accounts and the task and earnings information returned by the admin API." /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Loaded members" value={String(members.length)} helper="In the current API response" icon={UsersRound} tone="navy" /><StatCard label="Active in loaded list" value={String(activeCount)} helper="Accounts marked active" icon={UserCheck} tone="green" /><StatCard label="Tasks completed" value={String(members.reduce((sum, member) => sum + member.tasks, 0))} helper="Across loaded members" icon={ClipboardCheck} tone="blue" /></div><section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">Member directory</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Members</h2></div><div className="relative w-full sm:max-w-[260px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-field h-9 pl-9 text-xs" placeholder="Search loaded members" /></div></div>{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Tasks completed</th><th className="px-4 py-3 font-semibold">Total earned</th><th className="px-6 py-3 text-right font-semibold">Status</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((member) => <tr key={member.email} className="transition-colors hover:bg-canvas"><td className="px-6 py-4"><div className="flex items-center gap-3"><Avatar initials={member.initials} size="sm" tone="blue" /><div><p className="text-sm font-semibold text-ink">{member.name}</p><p className="mt-1 text-[11px] text-muted">{member.email}</p></div></div></td><td className="px-4 py-4 text-xs font-semibold text-ink">{member.tasks}</td><td className="number px-4 py-4 text-xs font-semibold text-navy">{formatCurrency(member.earned)}</td><td className="px-6 py-4 text-right"><StatusBadge tone={getTone(member.status)} dot>{member.status}</StatusBadge></td></tr>)}</tbody></table></div> : <TableEmpty message={members.length ? 'No members match your search.' : 'No member records were returned.'} />}</section></div>
}

function AdminReferralsPage() {
  return <div className="space-y-7"><PageHeader eyebrow="Growth operations" title="Referral activity" description="Review referral records, qualification state, and recorded reward values." /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Total referrals" value={adminStats.referralTotals} helper="Recorded referrals" icon={UsersRound} tone="navy" /><StatCard label="Qualified referrals" value={adminStats.qualifiedReferrals} helper={`Conversion ${adminStats.referralConversion}`} icon={TrendingUp} tone="green" /><StatCard label="Rewards paid" value={adminStats.referralRewardsPaid} helper="Recorded referral rewards" icon={CircleDollarSign} tone="blue" /></div><section className="card overflow-hidden"><div className="border-b border-line px-5 py-4 sm:px-6"><p className="eyebrow">Referral records</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Recent referral activity</h2></div>{adminReferrals.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Referrer</th><th className="px-4 py-3 font-semibold">Referred member</th><th className="px-4 py-3 font-semibold">Registered</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Reward</th></tr></thead><tbody className="divide-y divide-line">{adminReferrals.map((item) => <tr key={item.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-sm font-medium text-ink">{item.referrer}</td><td className="px-4 py-4 text-sm text-ink">{item.referredUser}</td><td className="px-4 py-4 text-xs text-muted">{item.registeredAt}</td><td className="px-4 py-4"><StatusBadge tone={getTone(item.status)} dot>{item.status}</StatusBadge></td><td className="number px-6 py-4 text-right text-sm font-semibold text-navy">{formatCurrency(item.reward)} · {item.rewardStatus}</td></tr>)}</tbody></table></div> : <TableEmpty message="No referral records were returned." />}</section></div>
}

function AdminTransactionsPage() {
  return <div className="space-y-7"><PageHeader eyebrow="Financial audit trail" title="Transactions" description="Review the ledger records returned for reimbursements, incentives, referral rewards, and payouts." /><section className="card overflow-hidden"><div className="border-b border-line px-5 py-4 sm:px-6"><p className="eyebrow">Ledger</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Transaction records</h2></div>{adminTransactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Reference</th><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Amount</th></tr></thead><tbody className="divide-y divide-line">{adminTransactions.map((row) => <tr key={row.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{row.id}</td><td className="px-4 py-4 text-sm font-medium text-ink">{row.member}</td><td className="px-4 py-4 text-xs text-muted">{row.type}</td><td className="px-4 py-4 text-xs text-muted">{row.createdAt}</td><td className="px-4 py-4"><StatusBadge tone={getTone(row.status)} dot>{row.status}</StatusBadge></td><td className="number px-6 py-4 text-right text-sm font-semibold text-navy">{formatCurrency(row.amount)}</td></tr>)}</tbody></table></div> : <TableEmpty message="No transaction records were returned." />}</section></div>
}

function AdminNotificationsPage() {
  return <div className="space-y-7"><PageHeader eyebrow="System messaging" title="Notifications" description="Review event-backed member notifications and queued email delivery status." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Sent this month" value={adminNotificationStats.sentThisMonth} helper="From notification records" icon={Send} tone="navy" /><StatCard label="Pending email" value={adminNotificationStats.pendingEmail} helper="Outbox items awaiting delivery" icon={Clock3} tone="orange" /><StatCard label="Failed email" value={adminNotificationStats.failedEmail} helper="Outbox items needing attention" icon={AlertCircle} tone="blue" /><StatCard label="Unread in-app" value={adminNotificationStats.unreadInApp} helper="Current notification records" icon={BellRing} tone="green" /></div><section className="card overflow-hidden"><div className="border-b border-line px-5 py-4 sm:px-6"><p className="eyebrow">Recent messages</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Notification log</h2></div>{adminNotifications.length ? <div className="divide-y divide-line">{adminNotifications.map((item) => <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-soft-blue text-navy"><BellRing size={16} /></span><div className="min-w-0"><p className="text-sm font-semibold text-ink">{item.title}</p><p className="mt-1 text-xs text-muted">{item.recipient} · {item.body}</p></div></div><div className="flex shrink-0 items-center justify-between gap-4 pl-12 sm:pl-0"><StatusBadge tone={getTone(item.emailStatus)} dot>{item.emailStatus}</StatusBadge><span className="text-[11px] text-subtle">{item.createdAt}</span></div></div>)}</div> : <TableEmpty message="No notification records were returned." />}</section></div>
}

function AdminSettingsPage({ onToast }: { onToast: (message: string) => void }) {
  const [requireReference, setRequireReference] = useState(false)
  const [autoDetect, setAutoDetect] = useState(false)
  const [flagCurrency, setFlagCurrency] = useState(false)
  const [notifyChanges, setNotifyChanges] = useState(false)
  const [payoutWindow, setPayoutWindow] = useState('')
  const [threshold, setThreshold] = useState('')
  const [pausePayouts, setPausePayouts] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const loadSettings = async () => {
    setLoadError('')
    try {
      const response = await api.adminSettings()
      const values = Object.fromEntries(response.data.map((item) => [item.key, item.value]))
      setRequireReference(values['verification.require_transaction_reference']?.enabled === true)
      setAutoDetect(values['verification.auto_detect_purchase_amount']?.enabled === true)
      setFlagCurrency(values['verification.flag_mismatched_currency']?.enabled === true)
      setNotifyChanges(values['verification.notify_member_on_changes']?.enabled === true)
      setPayoutWindow(String(values['payouts.window']?.label || ''))
      setThreshold(values['payouts.minimum_threshold']?.amount === undefined ? '' : String(values['payouts.minimum_threshold'].amount))
      setPausePayouts(values['payouts.paused']?.enabled === true)
      setWorkspaceName(String(values['platform.identity']?.workspace_name || ''))
      setSupportEmail(String(values['platform.identity']?.support_email || ''))
      setSettingsLoaded(true)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Settings could not be loaded.')
    }
  }
  useEffect(() => {
    void loadSettings()
  }, [])
  const saveSettings = async () => {
    if (!settingsLoaded) return
    if (!payoutWindow.trim() || threshold.trim() === '' || !Number.isFinite(Number(threshold)) || Number(threshold) < 0 || !workspaceName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.trim())) {
      onToast('Complete the payout window, non-negative threshold, workspace name, and valid support email.')
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        api.adminUpdateSetting('verification.require_transaction_reference', { enabled: requireReference }),
        api.adminUpdateSetting('verification.auto_detect_purchase_amount', { enabled: autoDetect }),
        api.adminUpdateSetting('verification.flag_mismatched_currency', { enabled: flagCurrency }),
        api.adminUpdateSetting('verification.notify_member_on_changes', { enabled: notifyChanges }),
        api.adminUpdateSetting('payouts.window', { label: payoutWindow }),
        api.adminUpdateSetting('payouts.minimum_threshold', { amount: Number(threshold) || 0 }),
        api.adminUpdateSetting('payouts.paused', { enabled: pausePayouts }),
        api.adminUpdateSetting('platform.identity', { workspace_name: workspaceName.trim(), support_email: supportEmail.trim() }),
      ])
      onToast('Settings saved.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'We could not save settings.')
    } finally {
      setSaving(false)
    }
  }
  return <div className="space-y-7"><PageHeader eyebrow="Workspace controls" title="Settings" description="Manage the operational defaults that shape task funding, verification, and payout workflows." actions={<><button disabled={!settingsLoaded} onClick={() => void loadSettings()} className="btn-secondary disabled:opacity-50">Reload settings</button><button disabled={saving || !settingsLoaded} onClick={() => void saveSettings()} className="btn-primary disabled:cursor-wait disabled:opacity-60"><Check size={16} /> {saving ? 'Saving...' : 'Save settings'}</button></>} />{loadError && <div role="alert" className="rounded-xl border border-[#F4B7B7] bg-[#FEF2F2] px-4 py-3 text-xs leading-5 text-error">{loadError} Settings controls remain unavailable until the API can be reached.</div>}<div className="grid gap-5 xl:grid-cols-2"><section className="card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><ShieldCheck size={19} /></span><div><p className="eyebrow">Verification rules</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Proof review defaults</h2></div></div><div className="mt-5 space-y-4"><label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas p-3.5"><span className="text-xs font-semibold text-ink">Require transaction reference</span><input disabled={!settingsLoaded} type="checkbox" checked={requireReference} onChange={(event) => setRequireReference(event.target.checked)} className="h-4 w-4 accent-[#1F3558]" /></label><label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas p-3.5"><span className="text-xs font-semibold text-ink">Auto-detect purchase amount</span><input disabled={!settingsLoaded} type="checkbox" checked={autoDetect} onChange={(event) => setAutoDetect(event.target.checked)} className="h-4 w-4 accent-[#1F3558]" /></label><label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas p-3.5"><span className="text-xs font-semibold text-ink">Flag mismatched currency</span><input disabled={!settingsLoaded} type="checkbox" checked={flagCurrency} onChange={(event) => setFlagCurrency(event.target.checked)} className="h-4 w-4 accent-[#1F3558]" /></label><label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas p-3.5"><span className="text-xs font-semibold text-ink">Notify member on request changes</span><input disabled={!settingsLoaded} type="checkbox" checked={notifyChanges} onChange={(event) => setNotifyChanges(event.target.checked)} className="h-4 w-4 accent-[#1F3558]" /></label></div></section><section className="card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF7ED] text-warning"><Landmark size={19} /></span><div><p className="eyebrow">Payout settings</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Settlement defaults</h2></div></div><div className="mt-5 space-y-4"><label className="block text-xs font-semibold text-ink">Default payout window<input disabled={!settingsLoaded} className="form-field mt-2" value={payoutWindow} onChange={(event) => setPayoutWindow(event.target.value)} /></label><label className="block text-xs font-semibold text-ink">Minimum payout threshold<input disabled={!settingsLoaded} className="form-field mt-2" type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label><label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas p-3.5"><span><span className="block text-xs font-semibold text-ink">Pause new payouts</span><span className="mt-1 block text-[11px] font-normal text-muted">Use during scheduled maintenance</span></span><input disabled={!settingsLoaded} type="checkbox" checked={pausePayouts} onChange={(event) => setPausePayouts(event.target.checked)} className="h-4 w-4 accent-[#1F3558]" /></label></div></section><section className="card p-5 sm:p-6 xl:col-span-2"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ECFDF3] text-success"><Globe2 size={19} /></span><div><p className="eyebrow">Platform identity</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Workspace details</h2></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">Workspace name<input disabled={!settingsLoaded} className="form-field mt-2" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Support email<input disabled={!settingsLoaded} type="email" className="form-field mt-2" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} /></label></div></section></div></div>
}

function DemoDataPanel({ onToast }: { onToast: (message: string) => void }) {
  const [status, setStatus] = useState<ApiDemoStatus | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [intent, setIntent] = useState<'refresh' | 'clear' | null>(null)
  const [confirmation, setConfirmation] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await api.adminDemoStatus()
      setStatus(response.data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Demo data status could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  const seed = async () => {
    setBusy(true)
    try {
      const response = await api.adminSeedDemo()
      setStatus(response.data)
      onToast('Demo data is seeded and ready.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Demo data could not be seeded.')
    } finally {
      setBusy(false)
    }
  }

  const runConfirmedAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!intent) return
    const expected = intent === 'clear' ? 'CLEAR DEMO DATA' : 'REFRESH DEMO DATA'
    if (confirmation !== expected) return
    setBusy(true)
    try {
      if (intent === 'clear') {
        const response = await api.adminClearDemo(confirmation)
        const next = await api.adminDemoStatus()
        setStatus(next.data)
        onToast(`Demo data cleared. ${response.data.files_deleted} synthetic proof files removed.`)
      } else {
        const response = await api.adminRefreshDemo(confirmation)
        setStatus(response.data)
        onToast('Demo data refreshed.')
      }
      setIntent(null)
      setConfirmation('')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The demo data action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  const expectedConfirmation = intent === 'clear' ? 'CLEAR DEMO DATA' : 'REFRESH DEMO DATA'
  const counts = status?.counts
  const metrics = [
    ['Users', counts?.users],
    ['Tasks', counts?.tasks],
    ['Reservations', counts?.reservations],
    ['Proofs', counts?.proofs],
    ['Payouts', counts?.payouts],
    ['Ledger entries', counts?.ledger_entries],
    ['Notifications', counts?.notifications],
  ] as const

  return <>
    <section className="card mt-7 p-5 sm:p-6" aria-labelledby="demo-data-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft-blue text-navy"><Database size={19} /></span>
          <div><p className="eyebrow">Client preview only</p><h2 id="demo-data-heading" className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Demo Data</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Synthetic activity comes from the real API. It does not represent real customers or purchases; payout events use the fake provider and demo email is suppressed.</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge tone={status?.installed ? 'success' : 'neutral'} dot>{loading ? 'Checking…' : status?.installed ? 'Installed' : 'Not seeded'}</StatusBadge>
          <button type="button" onClick={() => void loadStatus()} disabled={loading || busy} className="btn-ghost min-h-9 px-2.5 text-xs disabled:opacity-50" aria-label="Reload demo data status"><RefreshCw size={14} /></button>
        </div>
      </div>
      {loadError && <p role="alert" className="mt-4 rounded-lg border border-[#F4B7B7] bg-[#FEF2F2] px-3 py-2 text-xs text-error">{loadError}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-canvas px-3 py-3"><p className="text-[10px] font-medium text-muted">{label}</p><p className="number mt-1 text-lg font-semibold text-navy">{value ?? '—'}</p></div>)}</div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => void seed()} disabled={busy || loading} className="btn-primary min-h-10 px-3 text-xs disabled:opacity-50"><Database size={14} />{busy ? 'Working…' : 'Seed Demo Data'}</button>
        <button type="button" onClick={() => { setIntent('refresh'); setConfirmation('') }} disabled={busy || loading} className="btn-secondary min-h-10 px-3 text-xs disabled:opacity-50"><RefreshCw size={14} />Refresh Demo Data</button>
        <button type="button" onClick={() => { setIntent('clear'); setConfirmation('') }} disabled={busy || loading || !status?.installed} className="btn-ghost min-h-10 px-3 text-xs text-error hover:bg-[#FEF2F2] disabled:opacity-50"><Trash2 size={14} />Delete Demo Data</button>
      </div>
    </section>
    <Modal
      open={intent !== null}
      title={intent === 'clear' ? 'Delete demo data?' : 'Refresh demo data?'}
      description={intent === 'clear' ? 'Only this tagged demo batch and its synthetic proof files will be removed. Unrelated records are preserved; cleanup stops if an unmarked linked record is found.' : 'This removes and recreates the tagged demo batch. Any preview changes made to these synthetic records will be reset.'}
      onClose={() => { if (!busy) { setIntent(null); setConfirmation('') } }}
      size="sm"
    >
      <form onSubmit={(event) => void runConfirmedAction(event)} className="space-y-4">
        <label className="block text-xs font-semibold text-ink">Type <span className="font-mono text-navy">{expectedConfirmation}</span> to continue<input autoComplete="off" autoFocus className="form-field mt-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => { setIntent(null); setConfirmation('') }} disabled={busy} className="btn-secondary min-h-10 px-3 text-xs">Cancel</button><button type="submit" disabled={busy || confirmation !== expectedConfirmation} className={intent === 'clear' ? 'inline-flex min-h-10 items-center gap-2 rounded-lg bg-error px-3 text-xs font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50' : 'btn-primary min-h-10 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50'}>{busy ? 'Working…' : intent === 'clear' ? 'Delete batch' : 'Refresh batch'}</button></div>
      </form>
    </Modal>
  </>
}

function PublicHeader({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  return <header className="flex items-center justify-between py-5"><div className="flex items-center gap-3"><Logo onClick={() => onNavigate('landing')} /><ClientPreviewBadge /></div><nav className="hidden items-center gap-1 md:flex"><button onClick={() => onNavigate('how')} className="btn-ghost">How it works</button><button onClick={() => onNavigate('tasks')} className="btn-ghost">Browse tasks</button><button onClick={() => onNavigate('login')} className="btn-ghost">Sign in</button><button onClick={() => onNavigate('register')} className="btn-primary ml-2 min-h-10">Get started <ArrowRight size={15} /></button></nav><button onClick={() => onNavigate('register')} className="btn-primary min-h-10 px-3 text-xs md:hidden">Get started</button></header>
}

function LandingPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  return <div className="min-h-screen bg-white text-ink"><div className="mx-auto max-w-[1240px] px-5 sm:px-8"><PublicHeader onNavigate={onNavigate} /><section className="grid gap-10 pb-16 pt-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-24 lg:pt-16"><div><div className="inline-flex items-center gap-2 rounded-full border border-[#C8D8EB] bg-soft-blue px-3 py-1.5 text-[11px] font-semibold text-navy"><span className="h-1.5 w-1.5 rounded-full bg-success" /> A clearer way to earn online</div><h1 className="mt-6 max-w-[620px] text-[44px] font-semibold leading-[1.04] tracking-[-0.06em] text-ink sm:text-[64px]">Turn smart purchases into <span className="text-navy">real rewards.</span></h1><p className="mt-6 max-w-[530px] text-base leading-7 text-muted sm:text-lg">Click & Earn connects you with funded purchase tasks. Review the task terms, reserve a slot, submit purchase proof, and track the review and payout status.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={() => onNavigate('register')} className="btn-primary min-h-12 px-5">Start earning <ArrowRight size={17} /></button><button onClick={() => onNavigate('how')} className="btn-secondary min-h-12 px-5">See how it works <ChevronRight size={17} /></button></div><div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-success" /> Clear reward terms</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-navy" /> Status updates from the workflow</span><span className="flex items-center gap-2"><LockKeyhole size={15} className="text-navy" /> Secure proof review</span></div></div><div className="relative"><div className="absolute -inset-6 rounded-[40px] bg-soft-blue/70 blur-2xl" /><div className="relative overflow-hidden rounded-[28px] border border-[#C8D8EB] bg-[#F4F7FB] p-3 shadow-soft sm:p-5"><div className="overflow-hidden rounded-2xl border border-line bg-white"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-navy"><span className="h-3 w-3 rounded-[4px] border border-white" /></span><span className="text-xs font-bold text-ink">Click & Earn</span></div><span className="rounded-full bg-soft-blue px-2 py-1 text-[9px] font-semibold text-navy">Task details</span></div><div className="grid gap-3 p-4 sm:grid-cols-[1fr_0.88fr]"><div><p className="text-[10px] uppercase tracking-[0.12em] text-subtle">Task economics</p><h2 className="mt-1 text-base font-semibold text-ink">Know the terms before reserving</h2><div className="mt-5 space-y-3 rounded-xl bg-canvas p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-muted">Reimbursement</span><span className="text-[10px] font-semibold text-ink">Shown on each task</span></div><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-muted">Incentive</span><span className="text-[10px] font-semibold text-ink">Shown on each task</span></div><div className="border-t border-line pt-3"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-ink">Expected payout</span><span className="text-[10px] font-semibold text-navy">Calculated from task terms</span></div></div></div><div className="mt-4 flex items-center gap-2 rounded-lg bg-soft-blue px-3 py-2.5 text-[10px] leading-4 text-navy"><ShieldCheck size={15} /> The server records these values when a slot is reserved.</div></div><div className="rounded-xl bg-navy p-3 text-white"><p className="text-[10px] font-semibold">Reward workflow</p><div className="mt-5 space-y-3">{['Reserve a task', 'Complete the purchase', 'Submit proof', 'Review and payout'].map((step, index) => <div key={step} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full border border-white/20 text-[9px] font-semibold text-white/70">{index + 1}</span><span className="text-[10px] text-white/75">{step}</span></div>)}</div><div className="mt-6 rounded-lg bg-white/10 p-2.5"><p className="text-[9px] text-white/50">Each status is tied to a real workflow event.</p></div></div></div></div></div></div></section><section className="border-t border-line py-16 sm:py-20"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="eyebrow">A marketplace with receipts</p><h2 className="mt-2 max-w-lg text-3xl font-semibold leading-tight tracking-[-0.05em] text-ink sm:text-4xl">Every reward has a clear path from purchase to payout.</h2></div><p className="max-w-xl text-sm leading-6 text-muted">No mystery balances or vague promises. Click & Earn shows you the product price, incentive, proof requirements, and payout status up front.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3"><InfoStep number="01" title="Choose a funded task" body="Browse opportunities with the purchase amount, incentive, and remaining slots clearly displayed." icon={<Tag size={19} />} /><InfoStep number="02" title="Purchase & prove" body="Complete checkout with the partner, then upload a receipt or screenshot with the key details." icon={<FileCheck2 size={19} />} /><InfoStep number="03" title="Get paid" body="After verification, your reimbursement and incentive move through processing to your payout method." icon={<CircleDollarSign size={19} />} /></div></section><section className="pb-16 sm:pb-24"><div className="flex flex-col gap-5 rounded-[28px] bg-navy p-6 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between"><div><p className="eyebrow text-white/50">Ready when you are</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Make your next smart purchase count.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-white/60">Join a growing community completing useful, funded tasks and getting rewarded for the proof.</p></div><button onClick={() => onNavigate('register')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-navy transition-[background-color,transform] duration-200 hover:bg-soft-blue active:scale-[0.96]">Create your account <ArrowRight size={16} /></button></div></section><footer className="flex flex-col gap-4 border-t border-line py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between"><Logo compact /><span>© 2026 Click & Earn. Built for clear, proof-first rewards.</span><div className="flex gap-4"><button onClick={() => onNavigate('how')} className="hover:text-navy">How it works</button><button onClick={() => onNavigate('login')} className="hover:text-navy">Sign in</button></div></footer></div></div>
}

function InfoStep({ number, title, body, icon }: { number: string; title: string; body: ReactNode; icon: ReactNode }) {
  return <div className="card p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy">{icon}</span><span className="text-[11px] font-bold tracking-[0.16em] text-subtle">{number}</span></div><h3 className="mt-5 text-sm font-semibold text-ink">{title}</h3><p className="mt-2 text-xs leading-5 text-muted">{body}</p></div>
}

function HowPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  return <div className="min-h-screen bg-white text-ink"><div className="mx-auto max-w-[1000px] px-5 sm:px-8"><PublicHeader onNavigate={onNavigate} /><div className="py-12 sm:py-20"><button onClick={() => onNavigate('landing')} className="btn-ghost -ml-3 mb-6"><ArrowLeft size={16} /> Back home</button><p className="eyebrow">How Click & Earn works</p><h1 className="mt-2 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.06em] sm:text-6xl">One purchase. One proof. One clear reward journey.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-muted">Click & Earn is designed around transparency. You always know what you’ll pay, what you’ll earn, and exactly where your submission is in the process.</p><div className="mt-12 space-y-4">{[{ number: '01', title: 'Choose a task that fits', body: 'Browse funded tasks by category, reward, and available slots. Every card shows the full expected payout before you commit.', icon: <Tag size={20} /> }, { number: '02', title: 'Complete the external purchase', body: 'Open the partner checkout, purchase the digital product, and keep your confirmation or receipt close by.', icon: <ExternalLink size={20} /> }, { number: '03', title: 'Submit your proof', body: 'Return to Click & Earn and upload a screenshot, receipt, or PDF. Add the amount, date, time, and transaction reference.', icon: <Upload size={20} /> }, { number: '04', title: 'Track verification to payout', body: 'Your proof moves through verification, processing, and payout. You’ll receive an update at each meaningful step.', icon: <CircleDollarSign size={20} /> }].map((step) => <div key={step.number} className="grid gap-5 rounded-2xl border border-line bg-canvas p-5 sm:grid-cols-[72px_1fr_1.3fr] sm:items-center sm:p-7"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-navy text-sm font-bold text-white">{step.number}</span><div className="flex items-center gap-3 sm:block"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-navy sm:mb-3">{step.icon}</span><h2 className="text-lg font-semibold tracking-[-0.03em] text-ink">{step.title}</h2></div><p className="text-sm leading-6 text-muted">{step.body}</p></div>)}</div><div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#C8D8EB] bg-soft-blue p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="text-sm font-semibold text-navy">Ready to explore funded tasks?</p><p className="mt-1 text-xs text-[#526D96]">Create a free account and see your first opportunities.</p></div><button onClick={() => onNavigate('register')} className="btn-primary">Get started <ArrowRight size={15} /></button></div></div></div></div>
}

function AuthPage({ mode, onNavigate, onToast, onAuthenticated }: { mode: 'login' | 'register' | 'forgot'; onNavigate: (page: AppPage) => void; onToast: (message: string) => void; onAuthenticated: (user: ApiUser) => void }) {
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setServerError('')
    setFieldErrors({})
  }, [mode])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError('')
    setFieldErrors({})
    const values = new FormData(event.currentTarget)
    const firstName = String(values.get('first_name') || '').trim()
    const lastName = String(values.get('last_name') || '').trim()
    const email = String(values.get('email') || '').trim()
    const password = String(values.get('password') || '')
    const passwordConfirmation = String(values.get('password_confirmation') || '')

    if (isRegister && password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: 'Passwords do not match.' })
      setServerError('Please correct the highlighted fields.')
      return
    }

    setSubmitting(true)
    try {
      if (isForgot) {
        await api.forgotPassword(email)
        onToast('If an account exists, reset instructions have been sent.')
        onNavigate('login')
        return
      }

      if (isRegister) {
        const referralCode = new URLSearchParams(window.location.search).get('ref') || undefined
        await api.register(`${firstName} ${lastName}`.trim(), email, password, passwordConfirmation, referralCode)
      }
      else await api.login(email, password)

      const response = await api.me()
      onAuthenticated(response.data)
      onToast(isRegister ? 'Welcome to Click & Earn.' : 'Welcome back.')
    } catch (error) {
      if (!isForgot) setToken(null)
      const apiError = error as ApiError
      const details = apiError.details || {}
      const mappedErrors = Object.fromEntries(Object.entries(details).map(([key, messages]) => [key, messages[0]]))
      setFieldErrors(mappedErrors)
      setServerError(error instanceof TypeError ? 'We could not reach the server. Check that the backend is running.' : error instanceof Error ? error.message : 'We could not complete that request.')
    } finally {
      setSubmitting(false)
    }
  }

  const errorFor = (...keys: string[]) => keys.map((key) => fieldErrors[key]).find(Boolean)
  const submitLabel = submitting ? (isRegister ? 'Creating account…' : isForgot ? 'Sending…' : 'Signing in…') : (isRegister ? 'Create account' : isForgot ? 'Send reset link' : 'Sign in')

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[0.9fr_1.1fr]">
      <div className="hidden bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between"><Logo light /><div className="max-w-md"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#B9D7FF]"><ShieldCheck size={24} /></span><h1 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.05em]">A more trustworthy way to earn from digital products.</h1><p className="mt-5 text-sm leading-6 text-white/60">Click & Earn makes the path from purchase to payout simple, visible, and proof-first.</p><div className="mt-8 space-y-3">{['Clear reward terms', 'Secure proof review', 'Payout tracking'].map((item) => <div key={item} className="flex items-center gap-2 text-sm text-white/80"><CheckCircle2 size={16} className="text-[#8BE0AD]" />{item}</div>)}</div></div><p className="text-xs text-white/40">© 2026 Click & Earn</p></div>
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-20 lg:py-10"><div className="flex items-center justify-between"><Logo onClick={() => onNavigate('landing')} /><button onClick={() => onNavigate('landing')} className="btn-ghost">Back to site</button></div><div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-12"><p className="eyebrow">{isRegister ? 'Join Click & Earn' : isForgot ? 'Account recovery' : 'Welcome back'}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-ink">{isRegister ? 'Create your earning account' : isForgot ? 'Reset your password' : 'Sign in to your workspace'}</h2><p className="mt-3 text-sm leading-6 text-muted">{isRegister ? 'Start with a free account and see what’s available.' : isForgot ? 'Enter your email and we’ll send a secure reset link.' : 'Pick up where you left off.'}</p>
        {serverError && <div role="alert" className="mt-5 rounded-xl border border-[#F4B7B7] bg-[#FEF2F2] px-4 py-3 text-xs font-medium leading-5 text-error">{serverError}</div>}
        <form onSubmit={submit} className="mt-8 space-y-4">
          {isRegister && <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">First name<input name="first_name" autoComplete="given-name" className="form-field mt-2" required aria-invalid={Boolean(errorFor('first_name', 'name'))} />{errorFor('first_name', 'name') && <span className="mt-1 block text-[11px] font-normal text-error">{errorFor('first_name', 'name')}</span>}</label><label className="text-xs font-semibold text-ink">Last name<input name="last_name" autoComplete="family-name" className="form-field mt-2" required aria-invalid={Boolean(errorFor('last_name', 'name'))} />{errorFor('last_name', 'name') && <span className="mt-1 block text-[11px] font-normal text-error">{errorFor('last_name', 'name')}</span>}</label></div>}
          <label className="block text-xs font-semibold text-ink">Email address<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><input name="email" autoComplete="email" type="email" className="form-field pl-9" required aria-invalid={Boolean(fieldErrors.email)} /></div>{fieldErrors.email && <span className="mt-1 block text-[11px] font-normal text-error">{fieldErrors.email}</span>}</label>
          {!isForgot && <><label className="block text-xs font-semibold text-ink">Password<div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><input name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} type="password" className="form-field pl-9" minLength={8} required aria-invalid={Boolean(fieldErrors.password)} /></div>{fieldErrors.password && <span className="mt-1 block text-[11px] font-normal text-error">{fieldErrors.password}</span>}</label>{isRegister && <label className="block text-xs font-semibold text-ink">Confirm password<div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><input name="password_confirmation" autoComplete="new-password" type="password" className="form-field pl-9" minLength={8} required aria-invalid={Boolean(fieldErrors.password_confirmation)} /></div>{fieldErrors.password_confirmation && <span className="mt-1 block text-[11px] font-normal text-error">{fieldErrors.password_confirmation}</span>}</label>}</>}
          {mode === 'login' && <div className="flex justify-end"><button type="button" onClick={() => onNavigate('forgot')} className="text-xs font-semibold text-navy hover:text-accent">Forgot password?</button></div>}
          <button type="submit" disabled={submitting} className="btn-primary min-h-11 w-full disabled:cursor-wait disabled:opacity-60">{submitLabel} <ArrowRight size={16} /></button>
        </form>
        <div className="mt-7 border-t border-line pt-6 text-center text-xs text-muted">{isRegister ? <>Already have an account? <button onClick={() => onNavigate('login')} className="font-semibold text-navy hover:text-accent">Sign in</button></> : isForgot ? <>Remembered your password? <button onClick={() => onNavigate('login')} className="font-semibold text-navy hover:text-accent">Back to sign in</button></> : <>New to Click & Earn? <button onClick={() => onNavigate('register')} className="font-semibold text-navy hover:text-accent">Create an account</button></>}</div></div><p className="text-center text-[11px] text-subtle">By continuing, you agree to Click & Earn’s terms and privacy policy.</p></div>
    </div>
  )
}



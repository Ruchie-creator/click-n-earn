import { FormEvent, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
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
  Eye,
  EyeOff,
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
  Maximize2,
  Megaphone,
  Minus,
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
import { adminNotifications, adminNotificationStats, adminPayouts, adminReferrals, adminStats, adminTasks, adminTransactions, activity, clearAllData, dashboardStats, hydrateAdminData, hydrateAdminMembers, hydrateAdminNotifications, hydrateAdminPayouts, hydrateAdminReferrals, hydrateAdminSubmissions, hydrateAdminTasks, hydrateAdminTransactions, hydrateDashboardData, hydrateFinanceData, hydrateMarketplaceData, members, notificationUnreadCount, notifications, payouts, referrals, reservations, taskCategories, tasks, verificationQueue, type NotificationItem, type ReservationItem, type Task, type VerificationQueueItem } from './data'
import { api, getToken, setToken, type ApiAdminReferral, type ApiAdminSubmission, type ApiDemoStatus, type ApiError, type ApiFaq, type ApiPayoutMethod, type ApiPayoutVerification, type ApiTaskCategory, type ApiUser } from './api'
import type { ApiBeneficiarySchema } from './api/contracts'
import {
  AppPage,
  Avatar,
  CopyButton,
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
  Topbar,
  formatCurrency,
  type StatusTone,
} from './components'

type BeneficiarySchemaField = ApiBeneficiarySchema['fields'][number]
import { FeedbackProvider, useFeedback } from './feedback'
import PublicLandingPage from './public/landing/LandingPage'
import { PublicLegalPage, PublicNotFound, PublicTaskDetailPage, PublicTasksPage } from './public/PublicPages'

const memberPages: AppPage[] = ['dashboard', 'tasks', 'my-tasks', 'task-detail', 'proof', 'earnings', 'referrals', 'payouts', 'notifications', 'profile']
const adminPages: AppPage[] = ['admin-dashboard', 'admin-tasks', 'admin-submissions', 'admin-verification', 'admin-payout-verification', 'admin-payouts', 'admin-users', 'admin-referrals', 'admin-faqs', 'admin-transactions', 'admin-notifications', 'admin-settings', 'admin-profile']

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
  'admin-verification': 'Submissions',
  'admin-payout-verification': 'Bank account review',
  'admin-payouts': 'Payout management',
  'admin-users': 'Users',
  'admin-referrals': 'Referral activity',
  'admin-faqs': 'FAQ management',
  'admin-transactions': 'Transactions',
  'admin-notifications': 'Notifications',
  'admin-settings': 'Settings',
  'admin-profile': 'Profile',
}

const publicPageForPathname = (pathname: string): AppPage => {
  if (pathname === '/' || pathname === '/index.html') return 'landing'
  if (pathname === '/tasks') return 'public-tasks'
  if (pathname.startsWith('/tasks/')) return 'public-task'
  if (pathname === '/terms') return 'terms'
  if (pathname === '/privacy') return 'privacy'
  if (pathname === '/login') return 'login'
  if (pathname === '/register') return 'register'
  if (pathname === '/forgot-password') return 'forgot'
  if (pathname === '/reset-password') return 'reset-password'
  return 'not-found'
}

const decodeTaskSlug = (pathname: string): string => {
  try {
    return decodeURIComponent(pathname.slice('/tasks/'.length))
  } catch {
    return ''
  }
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
  return <FeedbackProvider><AppShell /></FeedbackProvider>
}

function AppShell() {
  const { notify: setToast, runOperation, runLoading } = useFeedback()
  const [page, setPage] = useState<AppPage>(() => {
    const pathname = window.location.pathname
    if (pathname === '/' || pathname === '/index.html') {
      const savedPage = window.history.state?.clickEarnPage
      if (typeof savedPage === 'string' && (memberPages.includes(savedPage as AppPage) || adminPages.includes(savedPage as AppPage))) {
        return savedPage as AppPage
      }
    }
    return publicPageForPathname(pathname)
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [proofFiles, setProofFiles] = useState<string[]>([])
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null)
  const proofIdempotency = useRef<{ signature: string; key: string } | null>(null)
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()))
  const [authChecking, setAuthChecking] = useState(() => Boolean(getToken()))
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
  const [, setDataVersion] = useState(0)
  const [requestedSubmissionId, setRequestedSubmissionId] = useState<number | null>(null)
  const canAccessAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const refreshMemberData = async () => {
    const [me, dashboard, taskResponse, reservationResponse, notificationResponse, earningsResponse, referralsResponse, payoutsResponse] = await Promise.all([
      api.me(), api.dashboard(), api.tasks(), api.reservations(), api.notifications(), api.earnings(), api.referrals(), api.payouts(),
    ])
    setCurrentUser(me.data)
    hydrateMarketplaceData({
      tasks: taskResponse.data.items,
      categories: taskResponse.data.meta.categories,
      reservations: reservationResponse.data.items,
      notifications: notificationResponse.data.items,
      unreadCount: notificationResponse.data.unread_count,
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
    if (window.location.pathname === '/reset-password') {
      setAuthChecking(false)
      return
    }
    if (!getToken()) return
    api.me()
      .then((response) => {
        setCurrentUser(response.data)
        setAuthenticated(true)
        setAuthChecking(false)
        if (new URLSearchParams(window.location.search).get('email_verified') === '1') setToast('Email address verified. Finish adding your bank account to unlock task reservations.', 'success')
        const roleCanAccessAdmin = response.data.role === 'admin' || response.data.role === 'super_admin'
        const savedPage = window.history.state?.clickEarnPage
        const currentPath = window.location.pathname
        const directPublicRoute = currentPath.startsWith('/tasks')
          || currentPath === '/terms'
          || currentPath === '/privacy'
        const requestedPage = new URLSearchParams(window.location.search).get('page')
        const allowedSavedPage = typeof savedPage === 'string'
          && (memberPages.includes(savedPage as AppPage) || (roleCanAccessAdmin && adminPages.includes(savedPage as AppPage)))
        const allowedRequestedPage = typeof requestedPage === 'string'
          && (memberPages.includes(requestedPage as AppPage) || (roleCanAccessAdmin && adminPages.includes(requestedPage as AppPage)))
        const landingPage: AppPage = roleCanAccessAdmin ? 'admin-dashboard' : 'tasks'
        const nextPage = directPublicRoute
          ? publicPageForPathname(currentPath)
          : allowedRequestedPage
            ? requestedPage as AppPage
            : allowedSavedPage
              ? savedPage as AppPage
              : landingPage
        setPage(nextPage)
        window.history.replaceState({ ...window.history.state, clickEarnPage: nextPage }, '', window.location.href)
      })
      .catch(() => {
        setToken(null)
        setCurrentUser(null)
        setAuthenticated(false)
        setAuthChecking(false)
        setPage('login')
        setToast('Your session has expired. Please sign in again.', 'warning')
      })
  }, [])

  useEffect(() => {
    if (!authenticated || !currentUser) return
    const loadWorkspace = async () => {
      const requests: Promise<void>[] = [refreshMemberData()]
      if (canAccessAdmin) requests.push(refreshAdminData())
      await Promise.all(requests)
    }
    void runLoading(canAccessAdmin ? 'Preparing the admin workspace' : 'Loading available tasks', 'Fetching the latest account, task, and notification data.', loadWorkspace)
  }, [authenticated, canAccessAdmin, currentUser?.id, runLoading])

  const handleAuthenticated = (user: ApiUser) => {
    clearAllData()
    setCurrentUser(user)
    setAuthenticated(true)
    setAuthChecking(false)
    const nextHref = new URLSearchParams(window.location.search).get('next')
    if (nextHref?.startsWith('/tasks/')) {
      window.history.replaceState({ clickEarnPage: 'public-task', selectedTaskId: '', selectedReservationId: null }, '', nextHref)
      setPage('public-task')
      return
    }
    const requestedPage = new URLSearchParams(window.location.search).get('page') as AppPage | null
    const isAdmin = user.role === 'admin' || user.role === 'super_admin'
    const nextPage: AppPage = requestedPage && (memberPages.includes(requestedPage) || (isAdmin && adminPages.includes(requestedPage)))
      ? requestedPage
      : isAdmin ? 'admin-dashboard' : 'tasks'
    window.history.replaceState({ clickEarnPage: nextPage, selectedTaskId: '', selectedReservationId: null }, '', window.location.href)
    setPage(nextPage)
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
    window.history.replaceState({ clickEarnPage: 'login' }, '', window.location.href)
    setToast('You have been signed out.')
  }

  const resendEmailVerification = async () => {
    try {
      await api.resendEmailVerification()
      setToast('A new verification email has been sent.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'We could not send a verification email. Please try again.', 'error')
    }
  }

  const navigate = (nextPage: AppPage, options: { force?: boolean; replace?: boolean; taskId?: string; reservationId?: number } = {}) => {
    if (adminPages.includes(nextPage) && !canAccessAdmin) {
      setToast('You do not have access to the admin workspace.')
      return
    }
    const nextTaskId = options.taskId ?? selectedTaskId
    const nextReservationId = options.reservationId ?? selectedReservationId
    const nextState = { ...window.history.state, clickEarnPage: nextPage, selectedTaskId: nextTaskId, selectedReservationId: nextReservationId }
    const href = nextPage === 'landing' ? '/' : nextPage === 'public-tasks' ? '/tasks' : nextPage === 'terms' ? '/terms' : nextPage === 'privacy' ? '/privacy' : nextPage === 'login' ? '/login' : nextPage === 'register' ? '/register' : nextPage === 'forgot' ? '/forgot-password' : nextPage === 'reset-password' ? '/reset-password' : window.location.href
    if (options.replace) window.history.replaceState(nextState, '', href)
    else if (options.force || nextPage !== page || options.taskId !== undefined || options.reservationId !== undefined) window.history.pushState(nextState, '', href)
    if (options.taskId !== undefined) setSelectedTaskId(options.taskId)
    if (options.reservationId !== undefined) setSelectedReservationId(options.reservationId)
    setPage(nextPage)
    setMobileOpen(false)
  }

  const navigatePublicHref = (href: string) => {
    const target = new URL(href, window.location.origin)
    let nextPage: AppPage = 'not-found'
    if (target.pathname === '/') nextPage = 'landing'
    else if (target.pathname === '/tasks') nextPage = 'public-tasks'
    else if (target.pathname.startsWith('/tasks/')) nextPage = 'public-task'
    else if (target.pathname === '/terms') nextPage = 'terms'
    else if (target.pathname === '/privacy') nextPage = 'privacy'
    else if (target.pathname === '/login') nextPage = 'login'
    else if (target.pathname === '/register') nextPage = 'register'
    else if (target.pathname === '/forgot-password') nextPage = 'forgot'
    else if (target.pathname === '/reset-password') nextPage = 'reset-password'
    window.history.pushState({ clickEarnPage: nextPage }, '', target.pathname + target.search + target.hash)
    setPage(nextPage)
    setMobileOpen(false)
    window.setTimeout(() => {
      if (target.hash) document.getElementById(target.hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      else window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }, 0)
  }

  useEffect(() => {
    const onPublicNavigate = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href
      if (href) navigatePublicHref(href)
    }
    window.addEventListener('click-earn:navigate', onPublicNavigate)
    return () => window.removeEventListener('click-earn:navigate', onPublicNavigate)
  })

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const nextPage = event.state?.clickEarnPage
      const publicPages: AppPage[] = ['landing', 'public-tasks', 'public-task', 'terms', 'privacy', 'not-found', 'login', 'register', 'forgot', 'reset-password']
      const canOpen = typeof nextPage === 'string'
        && (publicPages.includes(nextPage as AppPage) || memberPages.includes(nextPage as AppPage) || (canAccessAdmin && adminPages.includes(nextPage as AppPage)))
      if (!canOpen) {
        setPage(publicPageForPathname(window.location.pathname))
        setMobileOpen(false)
        return
      }
      setPage(nextPage as AppPage)
      if (typeof event.state?.selectedTaskId === 'string') setSelectedTaskId(event.state.selectedTaskId)
      if (typeof event.state?.selectedReservationId === 'number') setSelectedReservationId(event.state.selectedReservationId)
      setMobileOpen(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [canAccessAdmin])

  const previousRoute = useRef({ page, selectedTaskId })
  useEffect(() => {
    const changed = previousRoute.current.page !== page
      || (page === 'task-detail' && previousRoute.current.selectedTaskId !== selectedTaskId)
    previousRoute.current = { page, selectedTaskId }
    if (changed) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [page, selectedTaskId])

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? emptyTask
  const selectedReservation = reservations.find((reservation) => reservation.id === selectedReservationId) ?? null
  const reserveSelectedTask = async (): Promise<boolean> => {
    if (!selectedTask.id) {
      setToast('This task is no longer available.')
      return false
    }
    if (!currentUser?.eligible_to_reserve) {
      setToast(currentUser?.eligibility_message || 'Complete account verification before reserving a task.', 'warning')
      return false
    }
    return runOperation({
      title: 'Reserving your reward',
      description: 'Confirming the task details and securing an available slot.',
      successMessage: 'Reward reserved successfully',
      successDescription: 'Your reservation is ready. Submit proof after completing the purchase.',
    }, async () => {
      let response
      try {
        response = await api.reserveTask(selectedTask.id)
      } catch (error) {
        if ((error as ApiError).status === 404) {
          await refreshMemberData().catch(() => undefined)
          navigate('tasks', { replace: true, taskId: '' })
          throw new Error('This task list was refreshed. Please choose an available task and reserve it again.')
        }
        throw error
      }
      setSelectedReservationId(response.data.id)
      setProofFile(null)
      setProofFiles([])
      try {
        await refreshMemberData()
        navigate('proof', { reservationId: response.data.id })
      } catch {
        setToast('Your reward is reserved. Refresh My tasks to load the latest details.', 'warning')
        navigate('my-tasks', { reservationId: response.data.id })
      }
    })
  }
  const reservePublicTask = async (taskId: number): Promise<void> => {
    await runOperation({
      title: 'Reserving your reward',
      description: 'Confirming the task details and securing an available slot.',
      successMessage: 'Reward reserved successfully',
      successDescription: 'Your reservation is ready. Submit proof after completing the purchase.',
    }, async () => {
      const response = await api.reserveTask(taskId)
      setSelectedReservationId(response.data.id)
      setProofFile(null)
      setProofFiles([])
      await refreshMemberData()
      navigate('proof', { reservationId: response.data.id })
    })
  }
  const submitProof = async (details: { amount: string; date: string; time: string; reference: string; note: string }) => {
    if (!selectedReservationId || !proofFile) {
      setToast('Reserve the task and add a proof file first.')
      return
    }
    const signature = [selectedReservationId, proofFile.name, proofFile.size, proofFile.lastModified, details.amount, details.date, details.time, details.reference, details.note].join('|')
    const key = proofIdempotency.current?.signature === signature ? proofIdempotency.current.key : window.crypto.randomUUID()
    proofIdempotency.current = { signature, key }
    void runOperation({
      title: 'Submitting your proof',
      description: 'Uploading your file securely and sending the purchase details for review.',
      successMessage: 'Proof submitted successfully',
      successDescription: 'The verification team will review your submission and notify you of the result.',
    }, async () => {
      await api.submitProof(selectedReservationId, { file: proofFile, purchaseAmount: details.amount, purchaseDate: details.date, purchaseTime: details.time, reference: details.reference, note: details.note, idempotencyKey: key })
      proofIdempotency.current = null
      setProofFile(null)
      setProofFiles([])
      try { await refreshMemberData() } catch { setToast('Your proof was submitted, but the page could not refresh. Reload My tasks to see the latest status.', 'warning') }
    })
  }
  const showAppShell = memberPages.includes(page) || adminPages.includes(page)
  const admin = adminPages.includes(page)

  if (authChecking) return <div className="grid min-h-screen place-items-center bg-canvas text-sm font-medium text-muted">Checking your session…</div>
  if (page === 'landing') return <PublicLandingPage />
  if (page === 'public-tasks') return <PublicTasksPage />
  if (page === 'public-task') return <PublicTaskDetailPage slug={decodeTaskSlug(window.location.pathname)} authenticated={authenticated} onReserve={reservePublicTask} />
  if (page === 'terms') return <PublicLegalPage type="terms" />
  if (page === 'privacy') return <PublicLegalPage type="privacy" />
  if (page === 'not-found') return <PublicNotFound />
  if (page === 'how') return <LegacyHowPage onNavigate={navigate} />
  if (page === 'login' || page === 'register' || page === 'forgot' || page === 'reset-password') return <AuthPage mode={page === 'reset-password' ? 'reset' : page} onNavigate={navigate} onToast={setToast} onAuthenticated={handleAuthenticated} />
  if (showAppShell && !authenticated) return <AuthPage mode="login" onNavigate={navigate} onToast={setToast} onAuthenticated={handleAuthenticated} />
  if (!showAppShell) return null

  return (
    <div className="app-shell">
      <Sidebar admin={admin} page={page} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onOpenAdmin={() => navigate('admin-dashboard')} canAccessAdmin={canAccessAdmin} onLogout={() => void handleLogout()} unreadCount={notificationUnreadCount} reviewCount={Number(adminStats.pendingVerification) || 0} />
      <div className="min-h-screen md:pl-[264px]">
          <Topbar admin={admin} page={page} user={currentUser} userName={currentUser?.name || ''} unreadCount={notificationUnreadCount} notifications={notifications} onMenu={() => setMobileOpen(true)} onNavigate={navigate} onToast={setToast} onLogout={() => void handleLogout()} onRefresh={refreshMemberData} onNotificationSelect={(notification) => {
            const inAdminWorkspace = adminPages.includes(page) && canAccessAdmin
            if (inAdminWorkspace && notification.proofSubmissionId) {
              setRequestedSubmissionId(notification.proofSubmissionId)
              navigate('admin-submissions')
            } else if (inAdminWorkspace && notification.eventType?.startsWith('payout_verification.')) {
              navigate('admin-payout-verification')
            } else if (notification.payoutId || notification.eventType?.startsWith('payout.')) {
              navigate(inAdminWorkspace ? 'admin-payouts' : 'payouts')
            } else if (notification.reservationId) {
              const reservation = reservations.find((item) => item.id === notification.reservationId)
              navigate(reservation && ['reserved', 'changes_requested'].includes(reservation.status) ? 'proof' : 'my-tasks', { reservationId: notification.reservationId })
            } else if (notification.taskId) {
              const task = tasks.find((item) => item.id === String(notification.taskId))
              if (task) navigate('task-detail', { taskId: task.id, force: true })
              else navigate('my-tasks')
            } else if (notification.referralId || notification.eventType?.startsWith('referral.')) {
              navigate(inAdminWorkspace ? 'admin-referrals' : 'referrals')
            } else {
              navigate(inAdminWorkspace ? 'admin-notifications' : 'notifications')
            }
          }} />
        <main className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div key={`${page}-${page === 'task-detail' ? selectedTaskId : ''}`} className="page-transition">
            {admin ? <AdminRoutes page={page} user={currentUser} onUserUpdated={setCurrentUser} onNavigate={navigate} onToast={setToast} onRefresh={refreshAdminData} requestedSubmissionId={requestedSubmissionId} onRequestedSubmissionHandled={() => setRequestedSubmissionId(null)} /> : <MemberRoutes page={page} userName={currentUser?.name || ''} currentUser={currentUser} onUserUpdated={setCurrentUser} selectedTask={selectedTask} selectedReservation={selectedReservation} onNavigate={navigate} onSelectTask={(task) => navigate('task-detail', { taskId: task.id, force: true })} onChooseReservation={(id) => { setProofFile(null); setProofFiles([]); navigate('proof', { reservationId: id, force: true }) }} proofFiles={proofFiles} setProofFiles={setProofFiles} selectedProofFile={proofFile} onProofFile={setProofFile} onReserve={reserveSelectedTask} onSubmitProof={submitProof} onToast={setToast} onRefresh={refreshMemberData} onResendEmail={resendEmailVerification} />}
          </div>
        </main>
      </div>
    </div>
  )
}

function MemberRoutes({ page, userName, currentUser, onUserUpdated, selectedTask, selectedReservation, onNavigate, onSelectTask, onChooseReservation, proofFiles, setProofFiles, selectedProofFile, onProofFile, onReserve, onSubmitProof, onToast, onRefresh, onResendEmail }: { page: AppPage; userName: string; currentUser: ApiUser | null; onUserUpdated: (user: ApiUser) => void; selectedTask: Task; selectedReservation: ReservationItem | null; onNavigate: (page: AppPage) => void; onSelectTask: (task: Task) => void; onChooseReservation: (id: number) => void; proofFiles: string[]; setProofFiles: (files: string[]) => void; selectedProofFile: File | null; onProofFile: (file: File | null) => void; onReserve: () => Promise<boolean>; onSubmitProof: (details: { amount: string; date: string; time: string; reference: string; note: string }) => void; onToast: (message: string, kind?: 'success' | 'warning' | 'error' | 'info') => void; onRefresh: () => Promise<void>; onResendEmail: () => Promise<void> }) {
  if (page === 'dashboard') return <DashboardPage userName={userName} user={currentUser} onNavigate={onNavigate} onSelectTask={onSelectTask} onResendEmail={onResendEmail} />
  if (page === 'tasks') return <TasksPage user={currentUser} onNavigate={onNavigate} onSelectTask={onSelectTask} onResendEmail={onResendEmail} />
  if (page === 'my-tasks') return <MyTasksPage onNavigate={onNavigate} onChooseReservation={onChooseReservation} />
  if (page === 'task-detail') return <TaskDetailPage task={selectedTask} user={currentUser} onBack={() => onNavigate('tasks')} onReserve={onReserve} onNavigate={onNavigate} onResendEmail={onResendEmail} />
  if (page === 'proof') return selectedReservation
    ? <ProofPage key={selectedReservation.id} reservation={selectedReservation} files={proofFiles} setFiles={setProofFiles} selectedFile={selectedProofFile} onProofFile={onProofFile} onBack={() => onNavigate('my-tasks')} onSubmit={onSubmitProof} />
    : <EmptyState icon={ClipboardCheck} title="No active reservation selected" description="Choose one of your reserved tasks before submitting proof." action={<button onClick={() => onNavigate('my-tasks')} className="btn-secondary">View my tasks</button>} />
  if (page === 'earnings') return <EarningsPage />
  if (page === 'referrals') return <ReferralsPage onToast={onToast} />
  if (page === 'payouts') return <PayoutsPage onToast={onToast} onRefresh={onRefresh} user={currentUser} onNavigate={onNavigate} onResendEmail={onResendEmail} />
  if (page === 'notifications') return <NotificationsPage onToast={onToast} onRefresh={onRefresh} />
  return <ProfilePage user={currentUser} onUserUpdated={onUserUpdated} onToast={onToast} onNavigate={onNavigate} onResendEmail={onResendEmail} />
}

function AccountEligibilityPanel({ user, onNavigate, onResendEmail, compact = false }: { user: ApiUser | null; onNavigate: (page: AppPage) => void; onResendEmail: () => Promise<void>; compact?: boolean }) {
  const emailVerified = Boolean(user?.email_verified)
  const payoutStatus = user?.payout_verification_status || 'not_submitted'
  const payoutApproved = payoutStatus === 'approved' && !user?.duplicate_review_required
  const payoutLabel = user?.duplicate_review_required
    ? 'Payout information requires review'
    : payoutStatus === 'not_submitted' ? 'Not submitted'
      : payoutStatus.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  const checks = [
    { label: 'Email verified', complete: emailVerified, status: emailVerified ? 'Verified' : 'Action needed' },
    { label: 'Bank account submitted', complete: payoutStatus !== 'not_submitted', status: payoutStatus === 'not_submitted' ? 'Not submitted' : 'Submitted' },
    { label: 'Bank account approved', complete: payoutApproved, status: payoutApproved ? 'Approved' : payoutLabel },
    { label: 'Eligible to reserve tasks', complete: Boolean(user?.eligible_to_reserve), status: user?.eligible_to_reserve ? 'Ready' : 'Complete the steps above' },
  ]
  return <section className={`card ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`} aria-label="Account verification status">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><ShieldCheck size={17} className="shrink-0 text-navy" /><p className="eyebrow">Account setup</p></div>
        <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-ink">{user?.eligible_to_reserve ? 'You’re ready to reserve tasks' : 'Complete these steps to reserve tasks'}</h2>
        {!user?.eligible_to_reserve && user?.eligibility_message && <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{user.eligibility_message}</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {checks.map((check) => <div key={check.label} className="flex min-w-0 items-start gap-2 rounded-lg bg-canvas px-3 py-2.5">
            {check.complete ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" /> : <Clock3 size={15} className="mt-0.5 shrink-0 text-warning" />}
            <div className="min-w-0"><p className="text-[11px] font-semibold text-ink">{check.label}</p><p className="mt-0.5 truncate text-[10px] text-muted">{check.status}</p></div>
          </div>)}
        </div>
      </div>
      {!user?.eligible_to_reserve && <div className="flex shrink-0 flex-col gap-2 sm:min-w-[190px]">
        {!emailVerified
          ? <button onClick={() => void onResendEmail()} className="btn-primary min-h-10 text-xs"><Mail size={15} /> Resend verification email</button>
          : <button onClick={() => onNavigate('payouts')} className="btn-primary min-h-10 text-xs"><Landmark size={15} /> {payoutStatus === 'not_submitted' || payoutStatus === 'rejected' || payoutStatus === 'changes_requested' ? 'Add Bank Account' : 'View Bank Account'}</button>}
        <button onClick={() => onNavigate('profile')} className="btn-ghost min-h-9 text-xs">Open profile</button>
      </div>}
    </div>
  </section>
}

function DashboardPage({ userName, user, onNavigate, onSelectTask, onResendEmail }: { userName: string; user: ApiUser | null; onNavigate: (page: AppPage) => void; onSelectTask: (task: Task) => void; onResendEmail: () => Promise<void> }) {
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
    <AccountEligibilityPanel user={user} onNavigate={onNavigate} onResendEmail={onResendEmail} />
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

function TasksPage({ user, onNavigate, onSelectTask, onResendEmail }: { user: ApiUser | null; onNavigate: (page: AppPage) => void; onSelectTask: (task: Task) => void; onResendEmail: () => Promise<void> }) {
  const [initialFilters] = useState(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem('click-earn-task-filters') || '{}') as { search?: string; category?: string; sort?: string }
      return { search: saved.search || '', category: saved.category || 'All', sort: saved.sort || 'Recommended' }
    } catch {
      return { search: '', category: 'All', sort: 'Recommended' }
    }
  })
  const [search, setSearch] = useState(initialFilters.search)
  const [category, setCategory] = useState(initialFilters.category)
  const [sort, setSort] = useState(initialFilters.sort)
  useEffect(() => {
    window.sessionStorage.setItem('click-earn-task-filters', JSON.stringify({ search, category, sort }))
  }, [search, category, sort])
  const categories = ['All', ...new Set([...taskCategories, ...tasks.map((task) => task.category)].filter(Boolean))]
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.shortDescription} ${task.description} ${task.category}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (category === 'All' || task.category === category)
  })
  if (sort === 'Highest incentive') filteredTasks.sort((a, b) => b.incentive - a.incentive)
  if (sort === 'Most slots') filteredTasks.sort((a, b) => b.slots - a.slots)
  const activeFilterCount = Number(Boolean(search.trim())) + Number(category !== 'All') + Number(sort !== 'Recommended')
  const clearFilters = () => { setSearch(''); setCategory('All'); setSort('Recommended') }
  return <div className="space-y-7">
    <PageHeader eyebrow="Marketplace" title="Find your next task" description="Browse funded opportunities, review the task terms, and reserve a slot before purchasing." />
    {user && !user.eligible_to_reserve && <AccountEligibilityPanel compact user={user} onNavigate={onNavigate} onResendEmail={onResendEmail} />}
    <section className="card p-4 sm:p-5" aria-label="Filter available tasks">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1 lg:max-w-[440px]"><span className="sr-only">Search tasks</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-field h-11 bg-canvas pl-10" placeholder="Search tasks, details or categories" /></label>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <label className="flex h-11 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-medium text-muted focus-within:border-accent focus-within:ring-4 focus-within:ring-[#1F3558]/10"><SlidersHorizontal size={15} className="text-accent" /><span className="hidden sm:inline">Sort</span><select aria-label="Sort tasks" value={sort} onChange={(event) => setSort(event.target.value)} className="max-w-[156px] bg-transparent text-xs font-semibold text-ink focus:outline-none"><option>Recommended</option><option>Highest incentive</option><option>Most slots</option></select></label>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="btn-ghost min-h-11 px-3 text-xs">Clear filters <span className="grid h-5 min-w-5 place-items-center rounded-full bg-soft-blue px-1 text-[10px] text-navy">{activeFilterCount}</span></button>}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center">
          <span className="shrink-0 text-[11px] font-semibold text-muted">Category</span>
          <div className="thin-scroll flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="Task category">
            {categories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition-[background-color,color,box-shadow] ${category === item ? 'bg-navy text-white shadow-sm' : 'text-muted hover:bg-soft-blue hover:text-navy'}`}>{item}</button>)}
          </div>
        </div>
      </div>
    </section>
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted" aria-live="polite"><span className="font-semibold text-ink">{filteredTasks.length}</span> of {tasks.length} opportunities</p><p className="hidden text-xs text-subtle sm:block">Rewards are reserved while slots are available</p></div>
    {filteredTasks.length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredTasks.map((task) => <TaskCard key={task.id} task={task} onView={onSelectTask} />)}</div> : <EmptyState icon={Search} title={tasks.length ? 'No tasks found' : 'No tasks are available right now.'} description={tasks.length ? 'Try a broader search or clear your active filters.' : 'Check back soon for new earning opportunities.'} action={tasks.length && activeFilterCount ? <button onClick={clearFilters} className="btn-secondary">Clear filters</button> : undefined} />}
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
    {reservations.length ? <div className="space-y-4">{reservations.map((reservation) => <article key={reservation.id} className="card p-4 sm:p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-3">{reservation.task.image && <img src={reservation.task.image} alt="" className="task-image h-16 w-16 shrink-0 rounded-xl object-cover" />}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold text-ink">{reservation.task.title}</h2><StatusBadge tone={getTone(reservation.statusLabel)} dot>{reservation.statusLabel}</StatusBadge></div><p className="mt-1 text-xs text-muted">Reserved {reservation.reservedAt ? new Date(reservation.reservedAt).toLocaleString() : '—'} · {reservation.task.sponsor}</p><p className="number mt-2 text-sm font-semibold text-navy">Expected payout {formatCurrency(reservation.expectedPayout)}</p></div></div><div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas px-3 py-3 lg:w-[300px]"><div><p className="text-[10px] text-subtle">Reimbursement</p><p className="number mt-1 text-xs font-semibold text-ink">{formatCurrency(reservation.reimbursement)}</p></div><div><p className="text-[10px] text-subtle">Incentive</p><p className="number mt-1 text-xs font-semibold text-success">+{formatCurrency(reservation.incentive)}</p></div><div><p className="text-[10px] text-subtle">Deadline</p><p className="mt-1 text-xs font-semibold text-warning">{reservation.expiresAt ? new Date(reservation.expiresAt).toLocaleDateString() : '—'}</p></div></div><div className="flex shrink-0 gap-2">{needsProof(reservation.status) && <button onClick={() => onChooseReservation(reservation.id)} className="btn-primary flex-1 px-3 text-xs sm:flex-none">{reservation.status === 'changes_requested' ? 'View review note' : 'Submit proof'}</button>}</div></div></article>)}</div> : <EmptyState icon={ClipboardCheck} title="No tasks reserved yet." description="Browse available opportunities and reserve a slot to get started." action={<button onClick={() => onNavigate('tasks')} className="btn-primary">Browse tasks</button>} />}
  </div>
}

function TaskDetailPage({ task, user, onBack, onReserve, onNavigate, onResendEmail }: { task: Task; user: ApiUser | null; onBack: () => void; onReserve: () => Promise<boolean>; onNavigate: (page: AppPage) => void; onResendEmail: () => Promise<void> }) {
  const { processing } = useFeedback()
  const available = task.status.toLowerCase() === 'available' && task.slots > 0
  const eligible = Boolean(user?.eligible_to_reserve)
  const reserve = () => { if (available) void onReserve() }
  return <div className="space-y-7">
    <PageHeader back={onBack} eyebrow="Available task" title={task.title || 'Task details'} description={task.description || 'Task details are unavailable.'} actions={<StatusBadge tone={available ? 'success' : 'neutral'} dot>{task.status || 'Unavailable'} · {task.slots} slots left</StatusBadge>} />
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="card overflow-hidden"><div className="aspect-[2/1] max-h-[350px] overflow-hidden bg-[#E9EEF5]"><img src={task.image} alt="" className="task-image h-full w-full object-cover" /></div><div className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Sponsored by {task.sponsor}</p><p className="mt-1 text-sm font-semibold text-ink">What you’ll do</p></div><span className="rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-navy">{task.category}</span></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-canvas p-4"><p className="text-xs text-muted">Purchase reimbursement</p><p className="number mt-2 text-xl font-semibold tracking-[-0.04em] text-ink">{formatCurrency(task.productPrice)}</p><p className="mt-1 text-[11px] text-subtle">Paid at partner checkout</p></div><div className="rounded-xl bg-[#ECFDF3] p-4"><p className="text-xs text-success">Incentive</p><p className="number mt-2 text-xl font-semibold tracking-[-0.04em] text-success">+{formatCurrency(task.incentive)}</p><p className="mt-1 text-[11px] text-[#54B77A]">For completing the task</p></div><div className="rounded-xl bg-soft-blue p-4"><p className="text-xs text-navy">Expected payout</p><p className="number mt-2 text-xl font-semibold tracking-[-0.04em] text-navy">{formatCurrency(task.productPrice + task.incentive)}</p><p className="mt-1 text-[11px] text-accent">After approval</p></div></div><div className="mt-6 rounded-xl border border-[#C8D8EB] bg-soft-blue p-4"><div className="flex items-start gap-3"><Info size={17} className="mt-0.5 shrink-0 text-navy" /><div><p className="text-sm font-semibold text-navy">How reimbursement works</p><p className="mt-1 text-xs leading-5 text-[#526D96]">You pay the product price at the partner checkout. Once your proof is approved, Click & Earn returns the purchase price plus your incentive in one payout.</p></div></div></div><div className="mt-6"><h2 className="text-sm font-semibold text-ink">Instructions</h2><ol className="mt-3 space-y-3">{task.instructions.map((instruction, index) => <li key={instruction} className="flex gap-3 text-sm leading-6 text-muted"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft-blue text-xs font-semibold text-navy">{index + 1}</span><span>{instruction}</span></li>)}</ol></div><div className="mt-6 border-t border-line pt-6"><h2 className="text-sm font-semibold text-ink">Requirements</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{task.requirements.map((requirement) => <div key={requirement} className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 size={15} className="shrink-0 text-success" />{requirement}</div>)}</div></div></div></section>
      <div className="space-y-5"><section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Before you begin</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Reserve before purchasing</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><ShieldCheck size={19} /></span></div><p className="mt-4 text-xs leading-5 text-muted">The server confirms the available capacity and freezes this task’s reimbursement and incentive when your reservation is created.</p></section>{user && !eligible && <AccountEligibilityPanel compact user={user} onNavigate={onNavigate} onResendEmail={onResendEmail} />}<section className="card bg-navy p-5 text-white sm:p-6"><p className="eyebrow text-white/50">Ready to continue?</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em]">Reserve your task slot.</h2><p className="mt-2 text-xs leading-5 text-white/60">You’ll be taken to proof submission after the reservation is confirmed. Partner checkout is available from that page.</p><button disabled={!available || processing || !eligible} onClick={reserve} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-navy transition-[background-color,transform] duration-200 hover:bg-[#EEF3FA] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50">{processing ? 'Reserving…' : 'Reserve task'} <ArrowRight size={15} /></button>{!eligible && <button onClick={() => onNavigate(user?.eligibility_next_step === 'verify_email' ? 'profile' : 'payouts')} className="mt-3 min-h-9 w-full text-xs font-semibold text-[#B9D7FF] hover:text-white">{user?.eligibility_next_step === 'verify_email' ? 'Verify your email' : 'Complete bank account review'} <ArrowRight size={13} className="ml-1 inline" /></button>}</section><section className="card p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF7ED] text-warning"><CircleHelp size={17} /></span><div><p className="text-sm font-semibold text-ink">Need help?</p><p className="mt-1 text-xs leading-5 text-muted">Make sure your proof shows the purchase amount and reference number before you submit.</p></div></div></section></div>
    </div>
  </div>
}

function ProofPage({ reservation, files, setFiles, selectedFile, onProofFile, onBack, onSubmit }: { reservation: ReservationItem; files: string[]; setFiles: (files: string[]) => void; selectedFile: File | null; onProofFile: (file: File | null) => void; onBack: () => void; onSubmit: (details: { amount: string; date: string; time: string; reference: string; note: string }) => void }) {
  const { processing } = useFeedback()
  const task = reservation.task
  const latest = reservation.latestProof
  const [amount, setAmount] = useState(latest?.purchaseAmount ? String(latest.purchaseAmount) : '')
  const [date, setDate] = useState(latest?.purchaseDate || '')
  const [time, setTime] = useState(latest?.purchaseTime || '')
  const [reference, setReference] = useState(latest?.transactionReference || '')
  const [note, setNote] = useState('')
  const canSubmit = reservation.status === 'reserved'
  const hasCurrentFile = files.length > 0
  return <div className="space-y-7">
    <PageHeader back={onBack} eyebrow="Proof submission" title="Show us your purchase" description={`Upload proof for ${task.title}. The expected payout is ${formatCurrency(reservation.expectedPayout)} after approval.`} actions={<StatusBadge tone={getTone(reservation.statusLabel)} dot>{reservation.statusLabel}</StatusBadge>} />
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="card p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-line pb-5">{task.image && <img src={task.image} alt="" className="task-image h-12 w-12 rounded-xl object-cover" />}<div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{task.title}</p><p className="mt-0.5 text-xs text-muted">Expected payout <span className="number font-semibold text-navy">{formatCurrency(reservation.expectedPayout)}</span></p></div><span className="ml-auto hidden rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[11px] font-semibold text-success sm:inline-flex">Reservation #{reservation.id}</span></div>
        <div className="mt-6"><div className="mb-3"><p className="eyebrow">Proof file</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Upload your receipt or confirmation</h2></div>{canSubmit ? <FileUpload files={files} selectedFile={selectedFile} onFilesChange={(selected) => { setFiles(selected); if (!selected.length) onProofFile(null) }} onFilesSelected={(selected) => { onProofFile(selected[0] || null); setFiles(selected[0] ? [selected[0].name] : []) }} /> : <div className="rounded-xl border border-line bg-canvas p-4 text-xs text-muted">{latest ? `Current proof: ${latest.originalFileName}` : 'A proof file has been submitted.'} · {reservation.status === 'changes_requested' ? 'One proof has already been submitted, so another upload is not available. Review the administrator’s note in your notifications or contact support.' : 'Status updates come from the review workflow.'}</div>}</div>
        {canSubmit && <div className="mt-7 border-t border-line pt-6"><div className="mb-4"><p className="eyebrow">Purchase details</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Details shown on your proof</h2><p className="mt-1 text-xs text-muted">Enter the values from your receipt or purchase confirmation.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">Purchase amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="form-field mt-2" inputMode="decimal" /></label><label className="text-xs font-semibold text-ink">Transaction / reference no.<input required value={reference} onChange={(event) => setReference(event.target.value)} className="form-field mt-2" /></label><label className="text-xs font-semibold text-ink">Purchase date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="form-field mt-2" /></label><label className="text-xs font-semibold text-ink">Purchase time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="form-field mt-2" /></label><label className="text-xs font-semibold text-ink sm:col-span-2">Note for the reviewer<textarea value={note} onChange={(event) => setNote(event.target.value)} className="form-field mt-2 h-20 resize-none py-3" maxLength={1000} /></label></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={onBack} disabled={processing} className="btn-secondary disabled:opacity-60">Back to my tasks</button><button onClick={() => { if (hasCurrentFile) onSubmit({ amount, date, time, reference, note }) }} disabled={!hasCurrentFile || processing} className="btn-primary disabled:cursor-wait disabled:opacity-60">{processing ? 'Submitting…' : 'Submit for review'} <ArrowRight size={15} /></button></div>{!hasCurrentFile && <p className="mt-3 text-right text-xs text-warning">Add a proof file before submitting.</p>}</div>}
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
  const referralLink = referralCode ? new URL('/register?ref=' + encodeURIComponent(referralCode), window.location.origin).toString() : ''
  const qualified = referrals.filter((item) => item.qualificationStatus === 'qualified' || item.status === 'Successful')
  const pendingQualification = referrals.filter((item) => item.qualificationStatus !== 'qualified' && item.status !== 'Successful')
  const earnedRewards = qualified.reduce((total, item) => total + item.reward, 0)
  const paidRewards = referrals.filter((item) => item.rewardStatus === 'paid').reduce((total, item) => total + item.reward, 0)
  const rewardLabel = (value?: string) => value ? value.replace(/_/g, ' ') : 'Awaiting first approved task'
  return <div className="space-y-7">
    <PageHeader eyebrow="Invite & earn" title="Referrals" description="Track each invited member and the one-time reward tied to their first approved task." actions={<button disabled={!referralLink} className="btn-primary disabled:opacity-50" onClick={() => { if (referralLink) void navigator.clipboard?.writeText(referralLink).then(() => onToast('Referral link copied to your clipboard.')) }}><Copy size={16} /> Copy referral link</button>} />
    <section className="card overflow-hidden"><div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]"><div className="bg-navy p-5 text-white sm:p-7"><p className="eyebrow text-white/50">Your referral link</p><h2 className="mt-2 max-w-md text-[24px] font-semibold leading-tight tracking-[-0.04em]">Invite people you trust.</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/60">A referral reward can qualify once, after the person you invited completes their first approved purchase.</p><div className="mt-6 flex flex-col gap-2 sm:flex-row"><div className="flex min-h-11 min-w-0 flex-1 items-center rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white/75"><Link2 size={15} className="mr-2 shrink-0 text-[#B9D7FF]" /><span className="truncate">{referralLink || 'Referral link unavailable'}</span></div><CopyButton value={referralLink} onCopied={() => onToast('Referral link copied to your clipboard.')} /></div></div><div className="grid grid-cols-2 gap-px bg-line"><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">People referred</p><p className="number mt-2 text-[30px] font-semibold tracking-[-0.05em] text-navy">{referrals.length}</p><p className="mt-1 text-[11px] text-subtle">Recorded in your account</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">Pending qualification</p><p className="number mt-2 text-[30px] font-semibold tracking-[-0.05em] text-warning">{pendingQualification.length}</p><p className="mt-1 text-[11px] text-subtle">First approved task not recorded</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">Qualified rewards</p><p className="number mt-2 text-[30px] font-semibold tracking-[-0.05em] text-navy">{formatCurrency(earnedRewards)}</p><p className="mt-1 text-[11px] text-subtle">{qualified.length} one-time reward{qualified.length === 1 ? '' : 's'}</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs text-muted">Paid referral rewards</p><p className="number mt-2 text-[30px] font-semibold tracking-[-0.05em] text-success">{formatCurrency(paidRewards)}</p><p className="mt-1 text-[11px] text-subtle">{referrals.filter((item) => item.rewardStatus === 'paid').length} recorded as paid</p></div></div></div></section>
    <section className="card overflow-hidden"><div className="border-b border-line px-5 py-4 sm:px-6"><p className="eyebrow">Your network</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Referral history</h2></div>{referrals.length ? <div className="divide-y divide-line">{referrals.map((referral) => <article key={referral.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-center gap-3"><Avatar initials={referral.name.split(' ').map((part) => part[0]).join('')} size="sm" tone="blue" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{referral.name}</p><p className="mt-1 text-[11px] text-muted">Joined {referral.joined}</p></div></div><div className="flex flex-wrap gap-1.5"><StatusBadge tone={getTone(referral.status)} dot>{referral.status}</StatusBadge><StatusBadge tone={getTone(referral.rewardStatus || '')}>{rewardLabel(referral.rewardStatus)}</StatusBadge>{referral.payoutStatus && <StatusBadge tone={getTone(referral.payoutStatus)}>{rewardLabel(referral.payoutStatus)}</StatusBadge>}</div></div><div className="grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-3"><div><p className="text-[10px] text-subtle">First qualifying task</p><p className="mt-1 text-xs font-semibold text-ink">{referral.task || 'Not qualified yet'}</p></div><div><p className="text-[10px] text-subtle">Purchase amount</p><p className="number mt-1 text-xs font-semibold text-ink">{referral.purchaseAmount ? formatCurrency(referral.purchaseAmount) : '—'}</p></div><div><p className="text-[10px] text-subtle">Reward / paid date</p><p className="number mt-1 text-xs font-semibold text-navy">{qualified.includes(referral) ? formatCurrency(referral.reward) : '—'}{referral.paidAt ? ' · ' + new Date(referral.paidAt).toLocaleDateString() : ''}</p></div></div></article>)}</div> : <TableEmpty message="No referrals have been recorded for your account yet." />}</section>
  </div>
}
function normalizeBeneficiarySchemaFields(input: unknown): BeneficiarySchemaField[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((item): BeneficiarySchemaField[] => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const path = typeof raw.path === 'string' ? raw.path : ''
    const pathSegments = path.split('.').filter(Boolean)
    const derivedKey = pathSegments[pathSegments.length - 1] || ''
    const key = typeof raw.key === 'string' ? raw.key : derivedKey
    if (!path || !key) return []

    const rawField = raw.field && typeof raw.field === 'object' ? raw.field as Record<string, unknown> : undefined
    const options = Array.isArray(rawField?.options)
      ? rawField.options.flatMap((option) => option && typeof option === 'object' && typeof (option as Record<string, unknown>).value === 'string'
        ? [{
            value: (option as Record<string, unknown>).value as string,
            label: typeof (option as Record<string, unknown>).label === 'string' ? (option as Record<string, unknown>).label as string : (option as Record<string, unknown>).value as string,
            description: typeof (option as Record<string, unknown>).description === 'string' ? (option as Record<string, unknown>).description as string : undefined,
          }]
        : [])
      : undefined

    return [{
      key,
      path,
      required: Boolean(raw.required),
      rule: raw.rule && typeof raw.rule === 'object' ? raw.rule as BeneficiarySchemaField['rule'] : undefined,
      field: rawField ? {
        default: typeof rawField.default === 'string' ? rawField.default : undefined,
        description: typeof rawField.description === 'string' ? rawField.description : undefined,
        example: typeof rawField.example === 'string' ? rawField.example : undefined,
        label: typeof rawField.label === 'string' ? rawField.label : undefined,
        placeholder: typeof rawField.placeholder === 'string' ? rawField.placeholder : undefined,
        refresh: typeof rawField.refresh === 'boolean' ? rawField.refresh : undefined,
        tip: typeof rawField.tip === 'string' ? rawField.tip : undefined,
        type: ['INPUT', 'SELECT', 'DYNAMIC_SELECT', 'RADIO', 'TRANSFER_METHOD'].includes(String(rawField.type)) ? rawField.type as NonNullable<BeneficiarySchemaField['field']>['type'] : undefined,
        options,
      } : undefined,
    }]
  })
}

const US_STATE_OPTIONS = [
  'US-AL', 'US-AK', 'US-AZ', 'US-AR', 'US-CA', 'US-CO', 'US-CT', 'US-DE', 'US-FL', 'US-GA', 'US-HI', 'US-ID', 'US-IL', 'US-IN', 'US-IA', 'US-KS', 'US-KY', 'US-LA', 'US-ME', 'US-MD', 'US-MA', 'US-MI', 'US-MN', 'US-MS', 'US-MO', 'US-MT', 'US-NE', 'US-NV', 'US-NH', 'US-NJ', 'US-NM', 'US-NY', 'US-NC', 'US-ND', 'US-OH', 'US-OK', 'US-OR', 'US-PA', 'US-RI', 'US-SC', 'US-SD', 'US-TN', 'US-TX', 'US-UT', 'US-VT', 'US-VA', 'US-WA', 'US-WV', 'US-WI', 'US-WY',
]

function payoutFieldLabel(key: string) {
  return ({
    local_clearing_system: 'Local clearing system',
    bank_account_category: 'Account type',
    account_routing_type1: 'Routing number type',
    account_routing_value1: 'Routing number',
    country_code: 'Country',
    postcode: 'Postal code',
    street_address: 'Street address',
    personal_email: 'Email address',
    date_of_birth: 'Date of birth',
  } as Record<string, string>)[key] || key.replace(/_/g, ' ')
}

function countryFlag(code: string) {
  const normalized = code.toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? String.fromCodePoint(...[...normalized].map((letter) => 127397 + letter.charCodeAt(0))) : '🏳️'
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code
  } catch {
    return code
  }
}

function PayoutRequirementField({ field, value, country, onChange }: { field: BeneficiarySchemaField; value: string; country: string; onChange: (value: string) => void }) {
  const id = `payout-${field.path.replace(/[^a-z0-9]+/gi, '-')}`
  const common = { id, required: field.required, className: 'form-field mt-2', value, onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(field.key === 'local_clearing_system' ? event.target.value.toUpperCase() : event.target.value) }
  const label = <>{field.field?.label || payoutFieldLabel(field.key)}{field.required && <span className="ml-1 text-error">*</span>}</>
  const description = field.field?.description || field.field?.tip
  const options = Array.isArray(field.field?.options) ? field.field.options : []

  if (options.length > 0) return <label htmlFor={id} className="text-xs font-semibold text-ink">{label}<select {...common}><option value="">Select an option</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{description && <span className="mt-1 block text-[11px] font-normal leading-4 text-muted">{description}</span>}</label>

  if (field.key === 'bank_account_category') return <label htmlFor={id} className="text-xs font-semibold text-ink">{label}<select {...common}><option value="">Select account type</option><option value="CHECKING">Checking</option><option value="SAVINGS">Savings</option></select><span className="mt-1 block text-[11px] font-normal leading-4 text-muted">Choose the account type held by your bank.</span></label>
  if (field.key === 'local_clearing_system' && country.toUpperCase() === 'US') return <label htmlFor={id} className="text-xs font-semibold text-ink">{label}<select {...common}><option value="">Select transfer network</option><option value="ACH">ACH (local bank transfer)</option><option value="FEDWIRE">Fedwire</option></select><span className="mt-1 block text-[11px] font-normal leading-4 text-muted">ACH is the usual choice for a United States bank account.</span></label>
  if (field.key === 'account_routing_type1' && country.toUpperCase() === 'US') return <label htmlFor={id} className="text-xs font-semibold text-ink">{label}<select {...common}><option value="">Select routing number type</option><option value="aba">ABA routing number</option></select><span className="mt-1 block text-[11px] font-normal leading-4 text-muted">United States local transfers use an ABA routing number.</span></label>
  if (field.key === 'state' && country.toUpperCase() === 'US') return <label htmlFor={id} className="text-xs font-semibold text-ink">{label}<select {...common}><option value="">Select state</option>{US_STATE_OPTIONS.map((state) => <option key={state} value={state}>{state.replace('US-', '')}</option>)}</select></label>

  return <label htmlFor={id} className="text-xs font-semibold text-ink">{label}<input {...common} type={field.key === 'date_of_birth' ? 'date' : field.key === 'personal_email' ? 'email' : 'text'} inputMode={field.key.includes('routing') || field.key.includes('account') ? 'numeric' : undefined} placeholder={field.field?.placeholder || field.field?.example || (field.key === 'local_clearing_system' ? 'For example, ACH' : field.key === 'account_routing_type1' ? 'For example, ABA' : undefined)} autoComplete="off" />{description && <span className="mt-1 block text-[11px] font-normal leading-4 text-muted">{description}</span>}</label>
}

function PayoutsPage({ onToast, onRefresh, user, onNavigate, onResendEmail }: { onToast: (message: string) => void; onRefresh: () => Promise<void>; user: ApiUser | null; onNavigate: (page: AppPage) => void; onResendEmail: () => Promise<void> }) {
  const { runOperation, processing } = useFeedback()
  const [showModal, setShowModal] = useState(false)
  const [methods, setMethods] = useState<ApiPayoutMethod[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType] = useState('bank_account')
  const [entityType, setEntityType] = useState<'PERSONAL' | 'COMPANY'>('PERSONAL')
  const [transferMethod, setTransferMethod] = useState<'LOCAL' | 'SWIFT'>('LOCAL')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')
  const [schemaFields, setSchemaFields] = useState<BeneficiarySchemaField[]>([])
  const [beneficiaryValues, setBeneficiaryValues] = useState<Record<string, string>>({})
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaError, setSchemaError] = useState('')
  const [supportedCountries, setSupportedCountries] = useState<string[]>([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError] = useState('')
  const localClearingSystem = beneficiaryValues['beneficiary.bank_details.local_clearing_system']?.trim().toUpperCase() || ''
  useEffect(() => {
    let mounted = true
    api.payoutMethods().then((response) => { if (mounted) setMethods(response.data) }).catch((error) => { if (mounted) onToast(error instanceof Error ? error.message : 'Payout methods could not be loaded.') })
    setCountriesLoading(true)
    api.payoutMethodCountries()
      .then((response) => {
        if (!mounted) return
        const countries = Array.isArray(response.data?.countries) ? response.data.countries : []
        setSupportedCountries(countries.filter((code): code is string => typeof code === 'string' && /^[A-Z]{2}$/i.test(code)).map((code) => code.toUpperCase()))
        if (!Array.isArray(response.data?.countries)) setCountriesError('Supported bank countries could not be loaded. Enter a country code and try again.')
      })
      .catch((error) => { if (mounted) setCountriesError(error instanceof Error ? error.message : 'Supported countries could not be loaded.') })
      .finally(() => { if (mounted) setCountriesLoading(false) })
    return () => { mounted = false }
  }, [])
  const defaultMethod = methods.find((method) => method.is_default) || methods[0]
  const countryOptions = Array.from(new Set([...(Array.isArray(supportedCountries) ? supportedCountries : []), country.toUpperCase()].filter((value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value)))).sort()
  const openMethod = (method?: ApiPayoutMethod) => {
    setEditingId(method?.id || null)
    setAccountHolder(method?.account_holder_name || '')
    setAccountNumber('')
    setAccountType(method?.account_type || 'bank_account')
    setEntityType(method?.entity_type === 'COMPANY' ? 'COMPANY' : 'PERSONAL')
    setTransferMethod(method?.transfer_method === 'SWIFT' ? 'SWIFT' : 'LOCAL')
    setCountry(method?.country || '')
    setCurrency(method?.currency || '')
    setBeneficiaryValues({})
    setShowModal(true)
  }
  useEffect(() => {
    if (!showModal || country.length !== 2 || currency.length !== 3) {
      setSchemaFields([])
      setSchemaError('')
      return
    }
    let active = true
    setSchemaLoading(true)
    setSchemaError('')
    api.payoutMethodSchema({ country: country.toUpperCase(), currency: currency.toUpperCase(), entity_type: entityType, transfer_method: transferMethod, local_clearing_system: localClearingSystem || undefined })
      .then((response) => {
        if (!active) return
        const rawFields = response.data?.fields
        const fields = normalizeBeneficiarySchemaFields(rawFields)
        setSchemaFields(fields)
        setBeneficiaryValues((current) => {
          const defaults = fields.reduce<Record<string, string>>((values, field) => {
            const defaultValue = field.field?.default
            if (defaultValue && !current[field.path]) values[field.path] = defaultValue
            return values
          }, {})
          return Object.keys(defaults).length ? { ...current, ...defaults } : current
        })
        if (!Array.isArray(rawFields) || (rawFields.length > 0 && fields.length === 0)) setSchemaError('The selected bank route returned incomplete requirements. Your entries are preserved; change the route or try again.')
      })
      .catch((error) => { if (active) setSchemaError(error instanceof Error ? error.message : 'Bank requirements could not be loaded.') })
      .finally(() => { if (active) setSchemaLoading(false) })
    return () => { active = false }
  }, [showModal, country, currency, entityType, transferMethod, localClearingSystem])
  const dynamicFields = schemaFields.filter((field) => ![
    'beneficiary.entity_type', 'beneficiary.bank_details.bank_country_code', 'beneficiary.bank_details.account_currency',
    'transfer_method', 'beneficiary.company_name', 'beneficiary.bank_details.account_name', 'beneficiary.bank_details.account_number',
    'beneficiary.type',
  ].includes(field.path))
  const saveMethod = async () => {
    if (!accountHolder.trim() || accountNumber.trim().length < 4 || country.length !== 2 || currency.length !== 3) {
      onToast('Enter the account holder name and account number.')
      return
    }
    const missing = dynamicFields.find((field) => field.required && !beneficiaryValues[field.path]?.trim())
    if (schemaError) {
      onToast('Wait until the bank requirements load successfully before saving.')
      return
    }
    if (missing) {
      onToast(`Enter ${missing.key.replace(/_/g, ' ')} to continue.`)
      return
    }
    await runOperation({
      title: editingId ? 'Submitting updated bank details' : 'Submitting bank details',
      description: 'Sending your bank account information securely for verification.',
      successMessage: 'Bank details submitted securely',
      successDescription: 'Your bank account is now in the administrator review queue.',
    }, async () => {
      const routingDetails: Record<string, string> = {}
      const accountDetails: Record<string, unknown> = { account_number: accountNumber.trim(), type: 'BANK_ACCOUNT' }
      const address: Record<string, string> = {}
      const additionalInfo: Record<string, string> = {}
      dynamicFields.forEach((field) => {
        const value = beneficiaryValues[field.path]?.trim()
        if (!value) return
        if (field.path.startsWith('beneficiary.bank_details.')) routingDetails[field.key] = value
        else if (field.path.startsWith('beneficiary.address.')) address[field.key] = value
        else if (field.path.startsWith('beneficiary.additional_info.')) additionalInfo[field.key] = value
        else if (field.path === 'nickname') accountDetails.nickname = value
      })
      if (Object.keys(additionalInfo).length) accountDetails.additional_info = additionalInfo
      const payload = { provider: 'airwallex', account_holder_name: accountHolder.trim(), account_type: accountType, entity_type: entityType, transfer_method: transferMethod, country: country.toUpperCase(), currency: currency.toUpperCase(), is_default: true, routing_details: routingDetails, account_details: accountDetails, beneficiary_address: Object.keys(address).length ? address : undefined }
      const response = editingId ? await api.updatePayoutMethod(editingId, payload) : await api.savePayoutMethod(payload)
      setMethods((current) => [response.data, ...current.map((method) => ({ ...method, is_default: false, verification_status: method.verification_status === 'approved' ? 'superseded' : method.verification_status }))])
      setShowModal(false)
      await onRefresh()
    })
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Get paid" title="Payouts" description="Review your bank account approval status and track recorded payouts." actions={<button onClick={() => user?.email_verified ? openMethod() : void onResendEmail()} className="btn-primary"><Plus size={16} /> {user?.email_verified ? 'Add Bank Account' : 'Verify email to add bank account'}</button>} />
    {user && <AccountEligibilityPanel compact user={user} onNavigate={onNavigate} onResendEmail={onResendEmail} />}
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><section className="card p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="eyebrow">Default method</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">{defaultMethod ? ('Bank Account') : 'No bank account added'}</h2></div>{defaultMethod && <button onClick={() => openMethod(defaultMethod)} className="btn-ghost min-h-9 px-2.5"><Pencil size={14} /> Update Bank Account</button>}</div>{defaultMethod ? <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-canvas p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><Smartphone size={18} /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{defaultMethod.masked_account || 'Account details saved'}</p><p className="mt-1 text-[11px] text-muted">{defaultMethod.account_holder_name} · {defaultMethod.country} · {defaultMethod.currency}</p></div><StatusBadge tone={getTone(defaultMethod.status)} dot>{defaultMethod.verification_status.replace(/_/g, ' ')}</StatusBadge></div> : <div className="mt-6 rounded-xl bg-canvas p-4 text-xs leading-5 text-muted">Add a bank account to receive approved rewards.</div>}<div className="mt-5 flex items-start gap-2.5 text-xs leading-5 text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />Bank account details are encrypted and only authorized reviewers can view the full information.</div></section><section className="card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF7ED] text-warning"><Clock3 size={19} /></span><div><p className="eyebrow">Next payout</p>{(() => { const pending = payouts.find((payout) => ['Approved', 'Processing', 'Pending'].includes(payout.status)); return pending ? <><p className="number mt-1 text-[26px] font-semibold tracking-[-0.04em] text-navy">{formatCurrency(pending.amount)}</p><p className="mt-1 text-xs text-muted">{pending.method} · {pending.reference}</p><div className="mt-3"><StatusBadge tone={getTone(pending.status)} dot>{pending.status}</StatusBadge></div></> : <p className="mt-2 text-sm font-medium text-muted">No payout is currently in progress.</p> })()}</div></div></section></div>
    <section className="card overflow-hidden"><div className="border-b border-line px-5 py-4 sm:px-6"><p className="eyebrow">Payout history</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Recorded payouts</h2></div>{payouts.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Payout ID</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Method</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Amount</th></tr></thead><tbody className="divide-y divide-line">{payouts.map((payout) => <tr key={payout.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{payout.id}</td><td className="px-4 py-4 text-xs text-muted">{payout.date}</td><td className="px-4 py-4 text-xs text-muted">{payout.method}</td><td className="px-4 py-4"><StatusBadge tone={getTone(payout.status)} dot>{payout.status}</StatusBadge></td><td className="number px-6 py-4 text-right text-sm font-semibold text-navy">{formatCurrency(payout.amount)}</td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="text-xs font-semibold text-navy">{payout.id}</p><p className="mt-1 text-[11px] text-muted">{payout.date} · {payout.method}</p></div><div className="text-right"><p className="number text-xs font-semibold text-navy">{formatCurrency(payout.amount)}</p><StatusBadge tone={getTone(payout.status)}>{payout.status}</StatusBadge></div></div>)}</div></> : <TableEmpty message="No payouts yet." />}</section>
    <Modal open={showModal} title={editingId ? 'Update Bank Account' : 'Add Bank Account'} description="Your bank details are encrypted at rest. Updated account information must be approved before task reservations resume." onClose={() => { if (!processing) setShowModal(false) }}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-ink">Recipient type
            <select className="form-field mt-2" value={entityType} onChange={(event) => setEntityType(event.target.value as 'PERSONAL' | 'COMPANY')}>
              <option value="PERSONAL">Individual</option><option value="COMPANY">Company</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-ink">Transfer route
            <select className="form-field mt-2" value={transferMethod} onChange={(event) => setTransferMethod(event.target.value as 'LOCAL' | 'SWIFT')}>
              <option value="LOCAL">Local bank transfer</option><option value="SWIFT">International SWIFT</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-ink">Bank country
            {countryOptions.length > 0 ? <select required className="form-field mt-2" value={country} onChange={(event) => setCountry(event.target.value)} disabled={countriesLoading}>
              <option value="">{countriesLoading ? 'Loading supported countries…' : 'Select bank country'}</option>
              {countryOptions.map((code) => <option key={code} value={code}>{countryFlag(code)} {countryName(code)} ({code})</option>)}
            </select> : <input required className="form-field mt-2" value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} maxLength={2} placeholder="For example, US" autoComplete="country" />}
            {countriesError && <span className="mt-1 block text-[11px] font-normal leading-4 text-warning">{countriesError} Enter a two-letter country code and the selected bank route will be checked before saving.</span>}
          </label>
          <label className="text-xs font-semibold text-ink">Currency code
            <input required className="form-field mt-2" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} placeholder="For example, USD" autoComplete="off" />
          </label>
        </div>
        <div className="rounded-2xl border border-[#C8D8EB] bg-soft-blue p-4">
          <p className="text-xs font-semibold text-navy">Bank account details</p>
          <p className="mt-1 text-[11px] leading-5 text-[#526D96]">Select the recipient and route first. The fields below match the requirements for the selected bank destination.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink">{entityType === 'COMPANY' ? 'Company name' : 'Account holder name'}
              <input required className="form-field mt-2 bg-white" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} autoComplete="name" />
            </label>
            <label className="text-xs font-semibold text-ink">Bank account number
              <input required className="form-field mt-2 bg-white" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} autoComplete="off" inputMode="numeric" />
            </label>
          </div>
        </div>
        {schemaLoading && <p className="rounded-xl bg-soft-blue px-3 py-3 text-xs font-medium text-navy" role="status">Checking the bank requirements…</p>}
        {schemaError && <div className="rounded-xl border border-[#F4D7A6] bg-[#FFFBEB] px-3 py-3 text-xs leading-5 text-[#9A5B05]" role="alert"><strong>We could not refresh the bank requirements.</strong><br />{schemaError} Your entries are still here; correct the destination details or try again.</div>}
        {dynamicFields.length > 0 && <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-navy shadow-[0_1px_2px_rgba(23,32,51,0.08)]"><Landmark size={18} /></span><div><p className="text-sm font-semibold text-ink">Required bank details</p><p className="mt-1 text-[11px] leading-5 text-muted">Fields marked with an asterisk are required for this route. Choosing a transfer network updates the exact requirements.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">{dynamicFields.map((field) => <PayoutRequirementField key={field.path} field={field} value={beneficiaryValues[field.path] || ''} country={country} onChange={(value) => setBeneficiaryValues((current) => ({ ...current, [field.path]: value }))} />)}</div>
        </div>}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowModal(false)} disabled={processing} className="btn-secondary min-h-10 disabled:opacity-60">Cancel</button><button type="button" disabled={processing || schemaLoading || Boolean(schemaError)} onClick={() => void saveMethod()} className="btn-primary min-h-10 active:scale-[0.96] transition-transform disabled:cursor-wait disabled:opacity-60">Submit bank details <Check size={15} /></button></div>
      </div>
    </Modal>
  </div>
}

function NotificationsPage({ onToast, onRefresh }: { onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const { runOperation } = useFeedback()
  const [filter, setFilter] = useState('All')
  const filtered = notifications.filter((notification) => filter === 'All' || (filter === 'Unread' && notification.unread))
  const markAllRead = () => runOperation({ title: 'Marking notifications as read', description: 'Updating your notification inbox.', successMessage: 'Notifications marked as read.' }, async () => { await api.markAllNotificationsRead(); await onRefresh(); setFilter('All') })
  return <div className="space-y-7"><PageHeader eyebrow="Stay in the loop" title="Notifications" description="Updates about your tasks, proof reviews, payouts and referral rewards." actions={<button disabled={!notifications.some((notification) => notification.unread)} onClick={() => void markAllRead()} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"><Check size={16} /> Mark all as read</button>} /><section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6"><div className="flex gap-1"><button onClick={() => setFilter('All')} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${filter === 'All' ? 'bg-soft-blue text-navy' : 'text-muted hover:bg-canvas'}`}>All updates</button><button onClick={() => setFilter('Unread')} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${filter === 'Unread' ? 'bg-soft-blue text-navy' : 'text-muted hover:bg-canvas'}`}>Unread <span className="ml-1 text-[10px]">{notifications.filter((notification) => notification.unread).length}</span></button></div></div><div className="divide-y divide-line">{filtered.map((notification) => <div key={notification.id} className={`flex gap-3 px-5 py-5 sm:px-6 ${notification.unread ? 'bg-[#FBFCFE]' : ''}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${notification.tone === 'success' ? 'bg-[#ECFDF3] text-success' : notification.tone === 'processing' ? 'bg-[#EFF6FF] text-processing' : notification.tone === 'warning' ? 'bg-[#FFF7ED] text-warning' : 'bg-[#F0F9FF] text-info'}`}>{notification.icon === 'check' ? <CheckCircle2 size={18} /> : notification.icon === 'file' ? <FileCheck2 size={18} /> : notification.icon === 'users' ? <UsersRound size={18} /> : notification.icon === 'bookmark' ? <Bookmark size={18} /> : <Sparkles size={18} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-ink">{notification.title}</p>{notification.unread && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}</div><span className="text-[11px] text-subtle">{notification.time}</span></div><p className="mt-1 text-xs leading-5 text-muted">{notification.body}</p></div></div>)}</div>{filtered.length === 0 && <TableEmpty message={filter === 'Unread' ? 'No unread notifications.' : 'You’re all caught up.'} />}</section></div>
}

function ProfilePage({ user, onUserUpdated, onToast, onNavigate, onResendEmail }: { user: ApiUser | null; onUserUpdated: (user: ApiUser) => void; onToast: (message: string) => void; onNavigate?: (page: AppPage) => void; onResendEmail?: () => Promise<void> }) {
  const { runOperation, updateProgress, processing, notify } = useFeedback()
  const [firstName, setFirstName] = useState(user?.name.trim().split(/\s+/)[0] || '')
  const [lastName, setLastName] = useState(user?.name.trim().split(/\s+/).slice(1).join(' ') || '')
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const names = (user?.name || '').trim().split(/\s+/)
    setFirstName(names.shift() || '')
    setLastName(names.join(' '))
  }, [user?.name])

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(selectedPhoto)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedPhoto])

  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      onToast('Enter both your first and last name.')
      return
    }
    await runOperation({
      title: 'Updating your profile',
      description: 'Saving your account details securely.',
      successMessage: 'Profile updated successfully',
      successDescription: 'Your account details are up to date.',
    }, async () => {
      const response = await api.updateProfile({ name: firstName.trim() + ' ' + lastName.trim() })
      onUserUpdated(response.data)
    })
  }

  const uploadPhoto = async () => {
    if (!selectedPhoto) return
    await runOperation({
      title: 'Uploading profile photo',
      description: 'Uploading your selected image securely.',
      successMessage: 'Profile photo updated successfully',
      successDescription: 'Your new photo is now shown across your account.',
    }, async () => {
      const response = await api.updateProfilePhoto(selectedPhoto, updateProgress)
      onUserUpdated(response.data)
      setSelectedPhoto(null)
      updateProgress(null)
    })
    updateProgress(null)
  }

  const savePassword = async () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      onToast('Use at least 8 characters and make both new passwords match.')
      return
    }
    await runOperation({
      title: 'Updating your password',
      description: 'Confirming your current password and saving the new one.',
      successMessage: 'Password updated successfully',
      successDescription: 'Your sign-in credentials have been changed.',
    }, async () => {
      await api.changePassword({ current_password: currentPassword, password: newPassword, password_confirmation: confirmPassword })
      setShowPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    })
  }

  const choosePhoto = (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notify('Choose a JPG, PNG, or WebP image under 5 MB.', 'warning')
      if (photoInput.current) photoInput.current.value = ''
      return
    }
    setSelectedPhoto(file)
  }

  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || user?.name.slice(0, 1).toUpperCase() || '—'
  return <div className="space-y-7">
    <PageHeader eyebrow="Account settings" title="Profile" description="Update the personal details attached to your account, manage your profile photo, and change your password." actions={<button disabled={processing || !user} onClick={() => void saveProfile()} className="btn-primary disabled:cursor-wait disabled:opacity-60"><Check size={16} /> Save changes</button>} />
    {user?.role === 'member' && onNavigate && <AccountEligibilityPanel compact user={user} onNavigate={onNavigate} onResendEmail={onResendEmail || (() => Promise.resolve())} />}
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <section className="card p-5 sm:p-6">
        <p className="eyebrow">Your profile</p>
        <div className="mt-5 flex items-center gap-4">
          <Avatar initials={initials} src={photoPreview || user?.avatar_url} alt={`${user?.name || 'Your'} profile photo`} size="lg" />
          <div className="min-w-0"><p className="text-base font-semibold text-ink">{user?.name || '—'}</p><p className="mt-1 text-xs capitalize text-muted">{user?.account_status?.replace(/_/g, ' ') || 'Account details unavailable'}</p></div>
        </div>
        <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => photoInput.current?.click()} disabled={processing} className="btn-secondary min-h-9 px-3 text-xs"><Upload size={14} /> {selectedPhoto ? 'Replace photo' : 'Choose photo'}</button>
            {selectedPhoto && <><button type="button" onClick={() => void uploadPhoto()} disabled={processing} className="btn-primary min-h-9 px-3 text-xs"><Check size={14} /> Upload photo</button><button type="button" onClick={() => { setSelectedPhoto(null); if (photoInput.current) photoInput.current.value = '' }} disabled={processing} className="btn-ghost min-h-9 px-2 text-xs">Cancel</button></>}
          </div>
          <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose profile photo" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          <p className="mt-2 text-[11px] leading-4 text-muted">JPG, PNG or WebP · max 5 MB. Your image is checked by the server before it is saved.</p>
          {selectedPhoto && <p className="mt-2 truncate text-xs font-medium text-navy">{selectedPhoto.name} · {(selectedPhoto.size / 1024).toFixed(0)} KB</p>}
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-semibold text-ink">First name<input className="form-field mt-2" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
          <label className="block text-xs font-semibold text-ink">Last name<input className="form-field mt-2" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
          <label className="block text-xs font-semibold text-ink">Email address<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input className="form-field pl-9" value={user?.email || ''} readOnly /></div></label>
        </div>
      </section>
      <div className="space-y-5">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between"><div><p className="eyebrow">Security</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Password & sign-in</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><LockKeyhole size={18} /></span></div>
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-navy"><KeyRound size={16} /></span><div><p className="text-sm font-semibold text-ink">Password</p><p className="mt-0.5 text-xs text-muted">Update it securely from this page</p></div></div><button type="button" onClick={() => setShowPassword(true)} className="btn-secondary min-h-9 px-3 text-xs">Change password</button></div>
        </section>
      </div>
    </div>
    <Modal open={showPassword} title="Change password" description="Use a strong password you do not reuse elsewhere." onClose={() => setShowPassword(false)}>
      <div className="space-y-4">
        <PasswordField label="Current password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} required />
        <PasswordField label="New password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} minLength={8} required />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} minLength={8} required />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowPassword(false)} className="btn-secondary">Cancel</button><button type="button" disabled={processing} onClick={() => void savePassword()} className="btn-primary disabled:cursor-wait disabled:opacity-60">Update password <Check size={15} /></button></div>
      </div>
    </Modal>
  </div>
}
function AdminRoutes({ page, user, onUserUpdated, onNavigate, onToast, onRefresh, requestedSubmissionId, onRequestedSubmissionHandled }: { page: AppPage; user: ApiUser | null; onUserUpdated: (user: ApiUser) => void; onNavigate: (page: AppPage) => void; onToast: (message: string) => void; onRefresh: () => Promise<void>; requestedSubmissionId: number | null; onRequestedSubmissionHandled: () => void }) {
  if (page === 'admin-dashboard') return <AdminDashboardPage onNavigate={onNavigate} />
  if (page === 'admin-tasks') return <AdminTasksPage onToast={onToast} onRefresh={onRefresh} />
  if (page === 'admin-verification' || page === 'admin-submissions') return <AdminVerificationPage onToast={onToast} onRefresh={onRefresh} requestedSubmissionId={requestedSubmissionId} onRequestedSubmissionHandled={onRequestedSubmissionHandled} />
  if (page === 'admin-payout-verification') return <AdminPayoutVerificationPage onToast={onToast} onRefresh={onRefresh} />
  if (page === 'admin-payouts') return <AdminPayoutsPage onToast={onToast} onRefresh={onRefresh} />
  if (page === 'admin-referrals') return <AdminReferralsPage onToast={onToast} onRefresh={onRefresh} onNavigate={onNavigate} />
  if (page === 'admin-profile') return <ProfilePage user={user} onUserUpdated={onUserUpdated} onToast={onToast} onNavigate={onNavigate} />
  if (page === 'admin-faqs') return <AdminFaqsPage onToast={onToast} />
  return <AdminGenericPage page={page} onToast={onToast} />
}

function AdminPayoutVerificationPage({ onToast, onRefresh }: { onToast: (message: string, kind?: 'success' | 'warning' | 'error' | 'info') => void; onRefresh: () => Promise<void> }) {
  const { runOperation, processing } = useFeedback()
  const [items, setItems] = useState<ApiPayoutVerification[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState('pending_review')
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApiPayoutVerification | null>(null)
  const [action, setAction] = useState<'reject' | 'changes' | 'resolve_duplicate' | null>(null)
  const [reason, setReason] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const response = await api.adminPayoutVerifications({ status: filter, duplicates_only: String(duplicatesOnly) })
      setItems(response.data.items)
      setSummary(response.data.summary)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Bank account reviews could not be loaded.', 'error')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [filter, duplicatesOnly])
  const visible = items.filter((item) => `${item.member || ''} ${item.email || ''} ${item.masked_account}`.toLowerCase().includes(search.toLowerCase()))
  const openDetails = async (item: ApiPayoutVerification) => {
    try { setSelected((await api.adminPayoutVerification(item.id)).data) }
    catch (error) { onToast(error instanceof Error ? error.message : 'Bank account details could not be loaded.', 'error') }
  }
  const approve = async () => {
    if (!selected) return
    await runOperation({ title: 'Approving bank account', description: 'Recording the administrator decision and updating task eligibility.', successMessage: 'Bank account approved.' }, async () => {
      const response = await api.approvePayoutVerification(selected.id)
      setSelected((current) => current ? { ...current, ...response.data } : current)
      await load()
      await onRefresh()
    })
  }
  const applyReasonAction = async () => {
    if (!selected || !action || !reason.trim()) { onToast('Add a reason before continuing.', 'warning'); return }
    await runOperation({ title: action === 'reject' ? 'Rejecting bank account' : action === 'changes' ? 'Requesting bank account changes' : 'Resolving matching payout details', description: 'Saving the review decision and audit history.', successMessage: 'Review decision saved.' }, async () => {
      if (action === 'reject') await api.rejectPayoutVerification(selected.id, reason.trim())
      else if (action === 'changes') await api.requestPayoutVerificationChanges(selected.id, reason.trim())
      else await api.resolveDuplicatePayoutVerification(selected.id, reason.trim())
      setAction(null); setReason('')
      await openDetails(selected)
      await load()
      await onRefresh()
    })
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Account review" title="Bank account verification" description="Review encrypted bank details, record an explicit decision, and resolve matching-account alerts with an audit note." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Pending review" value={String(summary.pending ?? 0)} helper="Awaiting an administrator decision" icon={Clock3} tone="orange" />
      <StatCard label="Approved" value={String(summary.approved ?? 0)} helper="Bank accounts approved" icon={CheckCircle2} tone="green" />
      <StatCard label="Changes requested" value={String(summary.changes_requested ?? 0)} helper="Members need to resubmit details" icon={RefreshCw} tone="blue" />
      <StatCard label="Matching details" value={String(summary.duplicates ?? 0)} helper="Unresolved account-match reviews" icon={ShieldAlert} tone="orange" />
    </div>
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="eyebrow">Review list</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Member bank accounts</h2></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative"><span className="sr-only">Search members</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-field h-10 pl-9 text-xs" placeholder="Search name, email or last four" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="form-field h-10 text-xs" aria-label="Filter bank account verification status"><option value="pending_review">Pending review</option><option value="changes_requested">Changes requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All statuses</option></select>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium text-muted"><input type="checkbox" checked={duplicatesOnly} onChange={(event) => setDuplicatesOnly(event.target.checked)} /> Matching details</label>
        </div>
      </div>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Account</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Review</th></tr></thead><tbody className="divide-y divide-line">{visible.map((item) => <tr key={item.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4"><p className="text-sm font-semibold text-ink">{item.member || 'Member'}</p><p className="mt-1 text-[11px] text-muted">{item.email}</p></td><td className="px-4 py-4"><p className="text-xs font-semibold text-ink">{item.masked_account}</p><p className="mt-1 text-[11px] text-muted">{item.country} · {item.currency}</p>{item.duplicate_review_required && <span className="mt-1 inline-flex rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-semibold text-warning">Matching details require review</span>}</td><td className="px-4 py-4 text-xs text-muted">{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}</td><td className="px-4 py-4"><StatusBadge tone={getTone(item.status)} dot>{item.status.replace(/_/g, ' ')}</StatusBadge></td><td className="px-6 py-4 text-right"><button onClick={() => void openDetails(item)} className="btn-secondary min-h-9 px-3 text-xs">Review details</button></td></tr>)}</tbody></table></div> : <TableEmpty message={loading ? 'Loading bank account reviews…' : 'No bank account reviews match this filter.'} />}
    </section>
    <Modal open={Boolean(selected)} title="Bank account review" description="Full bank details are shown only in this authorized review view. Decisions and notes are recorded in review history." onClose={() => { setSelected(null); setAction(null); setReason('') }} size="lg">
      {selected && <div className="space-y-5">
        <div className="grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2"><div><p className="text-[11px] text-muted">Member</p><p className="mt-1 text-sm font-semibold text-ink">{selected.member} · {selected.email}</p></div><div><p className="text-[11px] text-muted">Status</p><div className="mt-1"><StatusBadge tone={getTone(selected.status)} dot>{selected.status.replace(/_/g, ' ')}</StatusBadge></div></div><div><p className="text-[11px] text-muted">Masked account</p><p className="mt-1 text-sm font-semibold text-ink">{selected.masked_account} · {selected.country} · {selected.currency}</p></div><div><p className="text-[11px] text-muted">Reviewed by</p><p className="mt-1 text-sm font-semibold text-ink">{selected.reviewed_by || 'Not reviewed'}</p></div></div>
        {selected.verification_reason && <div className="rounded-xl border border-[#F4D7A6] bg-[#FFFBEB] p-3 text-xs leading-5 text-[#9A5B05]"><strong>Member note:</strong> {selected.verification_reason}</div>}
        <section className="rounded-xl border border-line p-4"><h3 className="text-sm font-semibold text-ink">Bank details</h3><p className="mt-1 text-xs text-muted">Details are decrypted for this authorized view and are not included in notifications or review logs.</p><pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-canvas p-3 text-[11px] leading-5 text-ink">{JSON.stringify(selected.bank_details || {}, null, 2)}</pre></section>
        {selected.duplicate_matches?.length ? <section className="rounded-xl border border-[#F4D7A6] bg-[#FFFBEB] p-4"><div className="flex items-center gap-2"><ShieldAlert size={16} className="text-warning" /><h3 className="text-sm font-semibold text-ink">Matching payout details</h3></div><p className="mt-1 text-xs leading-5 text-muted">This is an account match for administrator review. It does not establish wrongdoing.</p><div className="mt-3 space-y-2">{selected.duplicate_matches.map((match) => <div key={match.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs"><span className="font-medium text-ink">{match.member} · {match.email}</span><span className="text-muted">{match.masked_account} · {match.status.replace(/_/g, ' ')}</span></div>)}</div><button onClick={() => { setAction('resolve_duplicate'); setReason('') }} disabled={processing || !selected.duplicate_review_required} className="btn-secondary mt-3 min-h-9 text-xs disabled:opacity-50">Resolve matching-details review</button></section> : null}
        <section className="rounded-xl border border-line p-4"><h3 className="text-sm font-semibold text-ink">Review history</h3>{selected.history?.length ? <div className="mt-3 divide-y divide-line">{selected.history.map((entry) => <div key={entry.id} className="py-2.5"><div className="flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold text-ink">{entry.action.replace(/_/g, ' ')} · {entry.actor || 'System'}</span><span className="text-muted">{new Date(entry.created_at).toLocaleString()}</span></div><p className="mt-1 text-xs text-muted">{entry.reason || `${entry.from_status || 'New'} → ${entry.to_status}`}</p></div>)}</div> : <p className="mt-2 text-xs text-muted">No review history is available.</p>}</section>
        {action && <div className="rounded-xl border border-[#C8D8EB] bg-soft-blue p-4"><label className="block text-xs font-semibold text-navy">{action === 'reject' ? 'Reason for rejecting' : action === 'changes' ? 'Changes requested' : 'Resolution note'}<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} className="form-field mt-2 min-h-24 bg-white py-3" /></label><div className="mt-3 flex justify-end gap-2"><button onClick={() => setAction(null)} className="btn-secondary min-h-9 text-xs">Cancel</button><button disabled={processing || !reason.trim()} onClick={() => void applyReasonAction()} className="btn-primary min-h-9 text-xs disabled:opacity-50">Save review note</button></div></div>}
        {!action && <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4"><button disabled={processing} onClick={() => { setAction('changes'); setReason('') }} className="btn-secondary min-h-10 text-xs">Request changes</button><button disabled={processing} onClick={() => { setAction('reject'); setReason('') }} className="btn-secondary min-h-10 text-xs">Reject</button><button disabled={processing || selected.status === 'approved' || selected.duplicate_review_required} onClick={() => void approve()} className="btn-primary min-h-10 text-xs disabled:opacity-50">Approve bank account</button></div>}
      </div>}
    </Modal>
  </div>
}

function AdminDashboardPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const changesRequested = verificationQueue.filter((item) => item.status === 'changes_requested').length
  return <div className="space-y-7">
    <PageHeader eyebrow="Operations overview" title="Admin dashboard" description="Review task submissions, bank account approvals, referral rewards, and payout health." actions={<button onClick={() => onNavigate('admin-tasks')} className="btn-primary"><Plus size={16} /> Create task</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Active tasks" value={adminStats.activeTasks} helper="Currently available" icon={Tag} tone="navy" onClick={() => onNavigate('admin-tasks')} /><StatCard label="Pending verification" value={adminStats.pendingVerification} helper="Open review queue" icon={FileClock} tone="orange" onClick={() => onNavigate('admin-verification')} /><StatCard label="Approved payouts" value={adminStats.approvedPayouts} helper="Awaiting processing" icon={WalletCards} tone="blue" onClick={() => onNavigate('admin-payouts')} /><StatCard label="Reserved rewards" value={adminStats.reservedRewards} helper="Current ledger total" icon={Bookmark} tone="navy" /><StatCard label="Total paid" value={adminStats.totalPaid} helper="Recorded paid payouts" icon={CircleDollarSign} tone="green" /><StatCard label="Active users" value={adminStats.activeUsers} helper="Accounts in active status" icon={UsersRound} tone="blue" /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Pending bank reviews" value={adminStats.pendingBankVerifications} helper="Bank accounts waiting for review" icon={Landmark} tone="orange" onClick={() => onNavigate('admin-payout-verification')} /><StatCard label="Approved bank accounts" value={adminStats.approvedBankVerifications} helper="Approved account records" icon={CheckCircle2} tone="green" onClick={() => onNavigate('admin-payout-verification')} /><StatCard label="Changes requested" value={adminStats.changesRequestedBankVerifications} helper="Members need to update details" icon={RefreshCw} tone="blue" onClick={() => onNavigate('admin-payout-verification')} /><StatCard label="Matching payout details" value={adminStats.duplicatePayoutDetails} helper="Unresolved administrator reviews" icon={ShieldAlert} tone="orange" onClick={() => onNavigate('admin-payout-verification')} /><StatCard label="Referral approvals" value={adminStats.pendingReferralApprovals} helper="Qualified rewards awaiting review" icon={UsersRound} tone="navy" onClick={() => onNavigate('admin-referrals')} /><StatCard label="Referral rewards to pay" value={adminStats.referralRewardsAwaitingPayout} helper="Approved rewards in payout queue" icon={WalletCards} tone="blue" onClick={() => onNavigate('admin-payouts')} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]"><section className="card p-5 sm:p-6"><p className="eyebrow">Financial overview</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Payout totals</h2><div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3"><div><p className="text-[11px] text-muted">Approved</p><p className="number mt-1 text-sm font-semibold text-navy">{adminStats.approvedPayouts}</p></div><div><p className="text-[11px] text-muted">Processing</p><p className="number mt-1 text-sm font-semibold text-processing">{adminStats.processingPayouts}</p></div><div><p className="text-[11px] text-muted">Paid</p><p className="number mt-1 text-sm font-semibold text-success">{adminStats.totalPaid}</p></div></div></section><section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Current queue</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Review status</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy"><BarChart3 size={19} /></span></div><div className="mt-6 space-y-3"><div className="flex justify-between text-xs"><span className="text-muted">Awaiting submissions</span><span className="font-semibold text-ink">{adminStats.pendingVerification}</span></div><div className="flex justify-between text-xs"><span className="text-muted">Changes requested in loaded queue</span><span className="font-semibold text-warning">{changesRequested}</span></div><div className="flex justify-between text-xs"><span className="text-muted">Items in loaded queue</span><span className="font-semibold text-ink">{verificationQueue.length}</span></div></div></section></div>
    <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6"><div><p className="eyebrow">Requires attention</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Pending submissions</h2></div><button onClick={() => onNavigate('admin-submissions')} className="btn-ghost">Open submissions <ArrowRight size={15} /></button></div>{verificationQueue.length ? <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[780px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Submission</th><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Task</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-6 py-3 text-right font-semibold">Confidence</th></tr></thead><tbody className="divide-y divide-line">{verificationQueue.slice(0, 3).map((item) => <tr key={item.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{item.id}</td><td className="px-4 py-4 text-sm font-medium text-ink">{item.member}</td><td className="px-4 py-4 text-xs text-muted">{item.task}</td><td className="px-4 py-4 text-xs text-muted">{item.submitted}</td><td className="px-6 py-4 text-right"><StatusBadge tone={item.confidence === 'High' ? 'success' : 'warning'} dot>{item.confidence}</StatusBadge></td></tr>)}</tbody></table></div> : <TableEmpty message="No submissions are waiting for review." />}</section>
  </div>
}

function AdminTasksPage({ onToast, onRefresh }: { onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const { runOperation, processing, notify } = useFeedback()
  const [showModal, setShowModal] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [categories, setCategories] = useState<ApiTaskCategory[]>([])
  const [categoryQuery, setCategoryQuery] = useState('')
  const visibleCategories = categories.filter((category) => category.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()))
  const [query, setQuery] = useState('')
  const filtered = adminTasks.filter((task) => `${task.title} ${task.category}`.toLowerCase().includes(query.toLowerCase()))
  const loadCategories = async () => {
    try { setCategories((await api.adminTaskCategories()).data) }
    catch (error) { onToast(error instanceof Error ? error.message : 'Task categories could not be loaded.') }
  }
  useEffect(() => { void loadCategories() }, [])
  const createCategory = async (name: string): Promise<ApiTaskCategory> => {
    const category = (await api.adminCreateTaskCategory(name)).data
    setCategories((current) => [...current.filter((item) => item.id !== category.id), category].sort((a, b) => a.name.localeCompare(b.name)))
    return category
  }
  const saveCategory = async (id: number, payload: { name?: string; is_active?: boolean }) => {
    try {
      const category = (await api.adminUpdateTaskCategory(id, payload)).data
      setCategories((current) => current.map((item) => item.id === id ? category : item).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) { onToast(error instanceof Error ? error.message : 'The category could not be updated.') }
  }
  const deleteCategory = async (category: ApiTaskCategory) => {
    if (!window.confirm(category.task_count ? `Archive “${category.name}”? Existing tasks will keep this category.` : `Delete “${category.name}”?`)) return
    try {
      const result = (await api.adminDeleteTaskCategory(category.id)).data
      onToast(result.archived ? 'Category archived. Existing tasks still use it.' : 'Category deleted.')
      await loadCategories()
    } catch (error) { onToast(error instanceof Error ? error.message : 'The category could not be removed.') }
  }
  const createTask = async (payload: Record<string, unknown>) => {
    await runOperation({ title: 'Creating task', description: 'Saving the task and refreshing the marketplace catalog.', successMessage: 'Task created and saved.' }, async () => {
      await api.adminCreateTask(payload)
      setShowModal(false)
      try { await onRefresh() } catch { notify('Task created successfully, but the task list could not refresh. Reload to see the latest catalog.', 'warning') }
    })
  }
  const changeTaskStatus = async (task: Task) => {
    const status = task.status.toLowerCase() === 'available' ? 'paused' : 'available'
    await runOperation({ title: status === 'paused' ? 'Pausing task' : 'Making task available', description: 'Updating the task and refreshing the catalog.', successMessage: status === 'paused' ? 'Task paused.' : 'Task made available.' }, async () => {
      await api.adminChangeTaskStatus(task.id, status)
      try { await onRefresh() } catch { notify('Task status updated, but the catalog could not refresh. Reload to see the latest status.', 'warning') }
    })
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Marketplace configuration" title="Task management" description="Fund new purchase opportunities, shape the member experience, and keep reward economics clear." actions={<div className="flex flex-col gap-2 sm:flex-row"><button disabled={processing} onClick={() => setShowCategoryManager(true)} className="btn-secondary disabled:opacity-60"><Settings2 size={15} /> Manage categories</button><button disabled={processing} onClick={() => setShowModal(true)} className="btn-primary disabled:opacity-60"><Plus size={16} /> Create task</button></div>} />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Available tasks" value={adminStats.activeTasks} helper="Current catalog" icon={Tag} tone="navy" /><StatCard label="Reserved slots" value={adminStats.reservedSlots} helper="Current capacity in use" icon={Bookmark} tone="blue" /><StatCard label="Reserved rewards" value={adminStats.reservedRewards} helper="Current ledger total" icon={Banknote} tone="green" /></div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">All opportunities</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Task catalog</h2></div><div className="relative w-full sm:max-w-[260px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="form-field h-9 pl-9 text-xs" placeholder="Search tasks" /></div></div>{filtered.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Task</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Economics</th><th className="px-4 py-3 font-semibold">Slots</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((task) => <tr key={task.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4"><div className="flex items-center gap-3">{task.image && <img src={task.image} alt="" className="task-image h-10 w-10 rounded-lg object-cover" />}<div><p className="text-sm font-semibold text-ink">{task.title}</p><p className="mt-0.5 text-[11px] text-muted">{task.sponsor}</p></div></div></td><td className="px-4 py-4"><span className="rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-navy">{task.category}</span></td><td className="px-4 py-4"><p className="number text-xs font-semibold text-ink">{formatCurrency(task.productPrice)} <span className="font-normal text-muted">+ {formatCurrency(task.incentive)}</span></p><p className="mt-1 text-[10px] text-subtle">{formatCurrency(task.productPrice + task.incentive)} total</p></td><td className="px-4 py-4 text-xs font-semibold text-ink">{task.slots}</td><td className="px-4 py-4"><StatusBadge tone={getTone(task.status)} dot>{task.status}</StatusBadge></td><td className="px-6 py-4 text-right"><button disabled={processing} onClick={() => void changeTaskStatus(task)} className="btn-secondary min-h-9 px-2.5 text-xs disabled:opacity-60">{task.status.toLowerCase() === 'available' ? 'Pause task' : 'Make available'}</button></td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{filtered.map((task) => <div key={task.id} className="flex items-start gap-3 px-5 py-4">{task.image && <img src={task.image} alt="" className="task-image h-12 w-12 shrink-0 rounded-lg object-cover" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-semibold text-ink">{task.title}</p><StatusBadge tone={getTone(task.status)}>{task.status}</StatusBadge></div><p className="mt-1 text-[11px] text-muted">{task.category} · {task.slots} slots · <span className="number font-semibold text-navy">{formatCurrency(task.productPrice + task.incentive)}</span></p></div><button disabled={processing} onClick={() => void changeTaskStatus(task)} className="btn-secondary min-h-8 px-2 text-[11px] disabled:opacity-60">{task.status.toLowerCase() === 'available' ? 'Pause' : 'Make available'}</button></div>)}</div></> : <TableEmpty message={adminTasks.length ? 'No tasks match your search.' : 'No tasks have been created yet.'} />}</section>
    <Modal open={showModal} title="Create a task" description="Set the economics and checkout details for a new funded opportunity." onClose={() => { if (!processing) setShowModal(false) }} size="lg"><CreateTaskForm categories={categories.filter((category) => category.is_active)} onCreateCategory={createCategory} onCategoryError={(message) => onToast(message)} onCancel={() => setShowModal(false)} onCreate={createTask} processing={processing} /></Modal>
    <Modal open={showCategoryManager} title="Task categories" description="Create, rename, deactivate, archive, or safely delete categories without breaking tasks." onClose={() => setShowCategoryManager(false)} size="lg">
      <form className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const name = String(form.get('category_name') || '').trim(); if (name) void createCategory(name).then(() => { formElement.reset(); onToast('Category created.') }).catch((error) => onToast(error instanceof Error ? error.message : 'Category could not be created.')) }}><input name="category_name" required maxLength={80} className="form-field min-h-10 flex-1" placeholder="New category name" /><button className="btn-primary min-h-10"><Plus size={15} /> Add category</button></form>
      <label className="relative mt-4 block"><span className="sr-only">Search categories</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><input value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} className="form-field h-10 pl-9 text-xs" placeholder="Search categories" /></label>
      <div className="mt-3 max-h-[55dvh] space-y-2 overflow-y-auto">{visibleCategories.map((category) => <form key={category.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void saveCategory(category.id, { name: String(form.get('name') || '').trim() }) }}><input name="name" defaultValue={category.name} maxLength={80} className="form-field min-h-9 flex-1 text-xs" aria-label={`Rename ${category.name}`} /><span className="min-w-24 text-[11px] text-muted">{category.task_count} {category.task_count === 1 ? 'task' : 'tasks'}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${category.is_active ? 'bg-[#ECFDF3] text-success' : 'bg-canvas text-muted'}`}>{category.is_active ? 'Active' : 'Archived'}</span><div className="flex gap-1"><button type="submit" className="btn-secondary min-h-9 px-2 text-[11px]">Save</button><button type="button" onClick={() => void saveCategory(category.id, { is_active: !category.is_active })} className="btn-ghost min-h-9 px-2 text-[11px]">{category.is_active ? 'Disable' : 'Enable'}</button><button type="button" onClick={() => void deleteCategory(category)} className="btn-ghost min-h-9 px-2 text-[11px] text-error"><Trash2 size={13} /> {category.task_count ? 'Archive' : 'Delete'}</button></div></form>)}{categories.length === 0 && <TableEmpty message="No categories yet. Add one to start organizing tasks." />}{categories.length > 0 && visibleCategories.length === 0 && <TableEmpty message="No categories match your search." />}</div>
    </Modal>
  </div>
}

function CreateTaskForm({ categories, onCreateCategory, onCategoryError, onCancel, onCreate, processing }: { categories: ApiTaskCategory[]; onCreateCategory: (name: string) => Promise<ApiTaskCategory>; onCategoryError: (message: string) => void; onCancel: () => void; onCreate: (payload: Record<string, unknown>) => Promise<void>; processing: boolean }) {
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [slots, setSlots] = useState('')
  const [price, setPrice] = useState('')
  const [incentive, setIncentive] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const validEconomics = Number(price) > 0 && Number.isFinite(Number(price)) && Number(incentive) >= 0 && Number.isFinite(Number(incentive)) && Number(slots) >= 1 && Number.isInteger(Number(slots))
  const payout = validEconomics ? Number(price) + Number(incentive) : null
  const selectedCategory = categories.find((item) => String(item.id) === categoryId)
  const matchingCategories = categories.filter((item) => item.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
  const addCategory = async () => {
    if (!newCategoryName.trim()) return
    setCategoryBusy(true)
    try {
      const category = await onCreateCategory(newCategoryName.trim())
      setCategoryId(String(category.id))
      setNewCategoryName('')
      setAddingCategory(false)
    } catch (error) {
      onCategoryError(error instanceof Error ? error.message : 'Category could not be created.')
    } finally { setCategoryBusy(false) }
  }
  const submit = () => {
    if (!title.trim() || !instructions.trim() || !selectedCategory || !validEconomics) return
    void onCreate({ title: title.trim(), category_id: selectedCategory.id, category: selectedCategory.name, description: instructions.trim(), reimbursement_amount: Number(price), incentive_amount: Number(incentive), available_slots: Number(slots), external_checkout_url: checkoutUrl.trim() || null, instructions: [instructions.trim()], proof_requirements: ['Upload a readable receipt', 'Include the transaction reference'], status: 'paused' })
  }
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink sm:col-span-2">Task title<input required className="form-field mt-2" value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="text-xs font-semibold text-ink"><label htmlFor="task-category" className="block">Category</label><input aria-label="Search categories" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} className="form-field mt-2" placeholder="Search categories" /><div className="mt-2 flex gap-2"><select id="task-category" required className="form-field min-w-0 flex-1" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select a category</option>{matchingCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button type="button" onClick={() => setAddingCategory((current) => !current)} className="btn-secondary min-h-11 shrink-0 px-3 text-xs"><Plus size={14} /> Add New Category</button></div>{matchingCategories.length === 0 && <p className="mt-1 text-[11px] text-muted">No category matches. Create one below.</p>}{addingCategory && <div className="mt-3 rounded-xl border border-[#C8D8EB] bg-soft-blue p-3"><p className="text-[11px] font-semibold text-navy">Add a category without leaving this task form</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input autoFocus maxLength={80} value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} className="form-field min-h-10 bg-white text-xs" placeholder="Category name" /><button type="button" disabled={categoryBusy || !newCategoryName.trim()} onClick={() => void addCategory()} className="btn-primary min-h-10 shrink-0 text-xs disabled:opacity-50">{categoryBusy ? 'Saving…' : 'Save category'}</button></div></div>}</div><label className="text-xs font-semibold text-ink">Available slots<input required min="1" step="1" className="form-field mt-2" type="number" value={slots} onChange={(event) => setSlots(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Product reimbursement<input required min="0.01" step="0.01" className="form-field mt-2" type="number" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" /></label><label className="text-xs font-semibold text-ink">Incentive<input required min="0" step="0.01" className="form-field mt-2" type="number" value={incentive} onChange={(event) => setIncentive(event.target.value)} inputMode="decimal" /></label><div className="sm:col-span-2 rounded-xl border border-[#C8D8EB] bg-soft-blue p-4"><p className="text-xs font-semibold text-navy">Expected payout</p><p className="number mt-1 text-2xl font-semibold tracking-[-0.04em] text-navy">{payout === null ? '—' : formatCurrency(payout)}</p><p className="mt-1 text-[11px] text-[#526D96]">Calculated from the reimbursement and incentive values entered above.</p></div><label className="text-xs font-semibold text-ink sm:col-span-2">External checkout URL<div className="relative mt-2"><Link2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input className="form-field pl-9" value={checkoutUrl} onChange={(event) => setCheckoutUrl(event.target.value)} /></div></label><label className="text-xs font-semibold text-ink sm:col-span-2">Task instructions<textarea required className="form-field mt-2 h-24 resize-none py-3" value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label></div><div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end"><button onClick={onCancel} disabled={processing} className="btn-secondary disabled:opacity-60">Cancel</button><button disabled={processing || !title.trim() || !instructions.trim() || !categoryId || !validEconomics} onClick={submit} className="btn-primary disabled:cursor-wait disabled:opacity-60">{processing ? 'Creating…' : 'Create draft'} <ArrowRight size={15} /></button></div></div>
}

function AdminVerificationPage({ onToast, onRefresh, requestedSubmissionId, onRequestedSubmissionHandled }: { onToast: (message: string) => void; onRefresh: () => Promise<void>; requestedSubmissionId: number | null; onRequestedSubmissionHandled: () => void }) {
  const { runLoading, runOperation, notify, processing } = useFeedback()
  const [submissions, setSubmissions] = useState<VerificationQueueItem[]>([])
  const [filter, setFilter] = useState('needs_review')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<VerificationQueueItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState('')
  const previewUrlRef = useRef<string | null>(null)
  const selected = selectedDetails?.id === selectedId ? selectedDetails : submissions.find((item) => item.id === selectedId)

  const loadSubmissions = async (status = filter, query = appliedSearch) => {
    setLoadingSubmissions(true)
    try {
      const params: Record<string, string> = {}
      if (status !== 'needs_review') params.status = status
      if (query.trim()) params.search = query.trim()
      const response = await api.adminSubmissions(params)
      setSubmissions(response.data.items.map((item: ApiAdminSubmission): VerificationQueueItem => {
        const score = item.verification?.confidence_score
        return {
          id: item.reference,
          backendId: item.id,
          status: item.status,
          member: item.member || 'Member',
          task: item.task || 'Task',
          submitted: item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—',
          amount: item.purchase_amount,
          reimbursement: item.reimbursement_amount,
          incentive: item.incentive_amount,
          expectedPayout: item.expected_payout,
          confidence: score === null || score === undefined ? 'Not checked' : score >= 0.85 ? 'High' : score >= 0.6 ? 'Medium' : 'Review',
          proof: item.file_name || 'Private proof file',
          downloadUrl: item.download_url,
          purchaseDate: item.purchase_date,
          purchaseTime: item.purchase_time,
          transactionReference: item.transaction_reference,
          userNote: item.user_note,
          detectedAmount: item.verification?.detected_amount,
          detectedDate: item.verification?.detected_date,
          detectedTime: item.verification?.detected_time,
          detectedReference: item.verification?.detected_reference,
          amountMatches: item.verification?.amount_matches,
          dateValid: item.verification?.date_valid,
          referencePresent: item.verification?.reference_present,
          warnings: item.verification?.warnings || [],
        }
      }))
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Submissions could not be loaded.')
    } finally {
      setLoadingSubmissions(false)
    }
  }

  useEffect(() => { void loadSubmissions('needs_review', '') }, [])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const setPrivatePreview = (url: string | null, type = '') => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = url
    setPreviewUrl(url)
    setPreviewType(type)
  }

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
    let openedItem = item
    let downloadedUrl: string | null = null
    let downloadedType = ''
    const loaded = await runLoading('Loading verification details', 'Fetching the submission record and its private proof file.', async () => {
      if (item.backendId) {
        const response = await api.adminSubmission(item.backendId)
        const detail = response.data
        const score = detail.verification?.confidence_score
        openedItem = {
          ...item,
          status: detail.status,
          member: detail.member || item.member,
          task: detail.task || item.task,
          amount: detail.purchase_amount,
          reimbursement: detail.reimbursement_amount ?? item.reimbursement,
          incentive: detail.incentive_amount ?? item.incentive,
          expectedPayout: detail.expected_payout ?? item.expectedPayout,
          confidence: score === null || score === undefined ? 'Not checked' : score >= 0.85 ? 'High' : score >= 0.6 ? 'Medium' : 'Review',
          proof: detail.file_name || item.proof,
          downloadUrl: detail.download_url,
          purchaseDate: detail.purchase_date,
          purchaseTime: detail.purchase_time,
          transactionReference: detail.transaction_reference,
          userNote: detail.user_note,
          detectedAmount: detail.verification?.detected_amount,
          detectedDate: detail.verification?.detected_date,
          detectedTime: detail.verification?.detected_time,
          detectedReference: detail.verification?.detected_reference,
          amountMatches: detail.verification?.amount_matches,
          dateValid: detail.verification?.date_valid,
          referencePresent: detail.verification?.reference_present,
          warnings: detail.verification?.warnings || [],
        }
        if (detail.status === 'proof_submitted') {
          await api.reviewSubmission(item.backendId)
          openedItem = { ...openedItem, status: 'under_review' }
        }
        try {
          const blob = await api.downloadAdminSubmission(item.backendId)
          downloadedUrl = URL.createObjectURL(blob)
          downloadedType = blob.type || (item.proof.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/unknown')
        } catch {
          notify('Submission details loaded. The proof preview is unavailable; you can still download the private file.', 'warning')
        }
        await onRefresh()
        await loadSubmissions()
      }
      setPrivatePreview(downloadedUrl, downloadedType)
      setSelectedDetails(openedItem)
      setSelectedId(openedItem.id)
    })
    if (!loaded && downloadedUrl) URL.revokeObjectURL(downloadedUrl)
  }

  useEffect(() => {
    if (requestedSubmissionId === null) return
    const item = submissions.find((entry) => entry.backendId === requestedSubmissionId) || {
      id: 'SUB-' + String(requestedSubmissionId).padStart(4, '0'),
      backendId: requestedSubmissionId,
      member: 'Member',
      task: 'Task',
      submitted: '—',
      amount: 0,
      reimbursement: 0,
      incentive: 0,
      expectedPayout: 0,
      confidence: 'Not checked',
      proof: 'Private proof file',
      warnings: [],
    }
    onRequestedSubmissionHandled()
    void openSubmission(item)
  }, [requestedSubmissionId, submissions])

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
    await runOperation({
      title: decision === 'Approved' ? 'Approving submission' : decision === 'Rejected' ? 'Rejecting submission' : 'Requesting proof changes',
      description: decision === 'Approved' ? 'Recording the review decision and updating the payout workflow.' : 'Saving the review decision and notifying the member.',
      successMessage: decision === 'Approved' ? 'Submission approved successfully' : decision === 'Rejected' ? 'Submission rejected' : 'Changes requested successfully',
      successDescription: decision === 'Approved' ? 'The server has recorded the approval and queued its payout flow.' : 'The server has recorded the review decision.',
    }, async () => {
      if (decision === 'Approved') await api.approveSubmission(selected.backendId!)
      if (decision === 'Request changes') await api.requestSubmissionChanges(selected.backendId!, reason.trim())
      if (decision === 'Rejected') await api.rejectSubmission(selected.backendId!, reason.trim())
      try { await onRefresh(); await loadSubmissions() } catch { notify('The review decision was recorded, but the queue could not refresh. Reload to see the latest status.', 'warning') }
      setSelectedId(null)
      setSelectedDetails(null)
      setPrivatePreview(null)
    })
    setBusy(false)
  }

  const setSelectedIdFromAction = (id: string | null) => {
    if (id === null) {
      setSelectedId(null)
      setSelectedDetails(null)
      setPrivatePreview(null)
      return
    }
    const item = submissions.find((entry) => entry.id === id)
    if (item) void openSubmission(item)
  }

  return <div className="space-y-7">
    <PageHeader eyebrow="Proof operations" title="Submissions" description="Search submissions, review proof, and track pending, approved, rejected, or changes-requested decisions." />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Needs review" value={adminStats.pendingVerification} helper="Current platform total" icon={FileClock} tone="orange" /><StatCard label="High confidence" value={String(submissions.filter((item) => item.confidence === 'High').length)} helper="In the selected view" icon={ShieldCheck} tone="green" /><StatCard label="Flagged submissions" value={String(submissions.filter((item) => item.warnings.length > 0).length)} helper="In the selected view" icon={ShieldAlert} tone="blue" /></div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:px-6"><div><p className="eyebrow">Proof records</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">All submission states</h2></div><form onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search); void loadSubmissions(filter, search) }} className="flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 flex-1"><span className="sr-only">Search submissions</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-field h-10 pl-9 text-xs" placeholder="Search member, email, task, reference" /></label><button type="submit" className="btn-secondary min-h-10">Search</button><select aria-label="Filter submissions by status" value={filter} onChange={(event) => { setFilter(event.target.value); void loadSubmissions(event.target.value) }} className="form-field min-h-10 sm:w-[190px]"><option value="needs_review">Needs review</option><option value="proof_submitted">Pending</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="changes_requested">Changes requested</option><option value="all">All submissions</option></select></form></div>{submissions.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[960px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Submission</th><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Task</th><th className="px-4 py-3 font-semibold">Purchase</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Review</th></tr></thead><tbody className="divide-y divide-line">{submissions.map((item) => <tr key={item.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{item.id}</td><td className="px-4 py-4"><div className="flex items-center gap-2.5"><Avatar initials={item.member.split(' ').map((part) => part[0]).join('')} size="sm" tone="blue" /><span className="text-sm font-medium text-ink">{item.member}</span></div></td><td className="px-4 py-4 text-xs text-muted">{item.task}</td><td className="number px-4 py-4 text-xs font-semibold text-ink">{formatCurrency(item.amount)}</td><td className="px-4 py-4 text-xs text-muted">{item.submitted}</td><td className="px-4 py-4"><StatusBadge tone={getTone(item.status || 'proof_submitted')} dot>{(item.status || 'proof_submitted').replace(/_/g, ' ')}</StatusBadge></td><td className="px-6 py-4 text-right"><button onClick={() => void openSubmission(item)} disabled={processing} className="btn-secondary min-h-9 px-3 text-xs disabled:opacity-60">View details <ArrowUpRight size={13} /></button></td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{submissions.map((item) => <button key={item.id} onClick={() => void openSubmission(item)} disabled={processing} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-canvas disabled:opacity-60"><Avatar initials={item.member.split(' ').map((part) => part[0]).join('')} size="sm" tone="blue" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-semibold text-ink">{item.member}</p><StatusBadge tone={getTone(item.status || 'proof_submitted')}>{(item.status || 'proof_submitted').replace(/_/g, ' ')}</StatusBadge></div><p className="mt-1 truncate text-[11px] text-muted">{item.task} · {item.submitted}</p></div><ChevronRight size={16} className="text-subtle" /></button>)}</div></> : <TableEmpty message={loadingSubmissions ? 'Loading submissions…' : 'No submissions match this status or search.'} />}</section>
    <Modal open={Boolean(selected)} title="Review Task Submission" description={selected ? `${selected.task} · ${selected.member} · ${selected.id}` : undefined} headerAside={selected ? <StatusBadge tone={getTone(selected.status || 'Under review')} dot>{selected.status?.replace(/_/g, ' ') || 'Under review'}</StatusBadge> : null} onClose={() => setSelectedIdFromAction(null)} size="xl" bodyClassName="overflow-hidden">{selected && <ReviewSubmission key={selected.id} item={selected} busy={busy || processing} canDecide={selected.status === 'under_review'} previewUrl={previewUrl} previewType={previewType} onDownload={() => void downloadProof(selected)} onDecision={handleDecision} />}</Modal>
  </div>
}
function ReviewSubmission({ item, busy, canDecide, previewUrl, previewType, onDownload, onDecision }: { item: VerificationQueueItem; busy: boolean; canDecide: boolean; previewUrl: string | null; previewType: string; onDownload: () => void; onDecision: (decision: 'Approved' | 'Request changes' | 'Rejected', reason: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pendingDecision, setPendingDecision] = useState<'Approved' | 'Request changes' | 'Rejected' | null>(null)
  const [validationMessage, setValidationMessage] = useState('')
  const requestDecision = (decision: 'Approved' | 'Request changes' | 'Rejected') => {
    if (decision !== 'Approved' && !note.trim()) {
      setValidationMessage('Add a reviewer note before requesting changes or rejecting this proof.')
      return
    }
    setValidationMessage('')
    setPendingDecision(decision)
  }
  const confirmDecision = async () => {
    if (!pendingDecision) return
    const decision = pendingDecision
    setPendingDecision(null)
    await onDecision(decision, note)
  }
  const confidenceTone = item.confidence === 'High' ? 'success' : item.confidence === 'Review' ? 'error' : 'warning'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] lg:overflow-hidden">
        <section className="flex min-h-[420px] flex-col bg-[#111E34] p-4 text-white sm:p-5 lg:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Private proof</p><p className="mt-1 truncate text-xs font-semibold text-white/85">{item.proof}</p></div><div className="flex items-center gap-1">{previewType.startsWith('image/') && <><button type="button" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))} className="grid h-10 w-10 place-items-center rounded-lg text-white/65 transition-[background-color,color,transform] hover:bg-white/10 hover:text-white active:scale-[0.96]" aria-label="Zoom out"><Minus size={16} /></button><span className="number min-w-12 text-center text-[11px] text-white/55">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.25))} className="grid h-10 w-10 place-items-center rounded-lg text-white/65 transition-[background-color,color,transform] hover:bg-white/10 hover:text-white active:scale-[0.96]" aria-label="Zoom in"><Plus size={16} /></button></>}</div></div>
          <div className="thin-scroll flex min-h-[300px] flex-1 items-center justify-center overflow-auto rounded-xl bg-[#091426] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
            {previewUrl && previewType.startsWith('image/') ? <img src={previewUrl} alt={`Proof file ${item.proof}`} className="max-h-full max-w-full object-contain transition-transform duration-200" style={{ transform: `scale(${zoom})` }} />
              : previewUrl && previewType === 'application/pdf' ? <iframe title={`PDF proof preview: ${item.proof}`} src={`${previewUrl}#view=FitH`} className="h-full min-h-[430px] w-full bg-white" />
                : <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-[#B9D7FF]"><ImageIcon size={24} /></span><p className="mt-4 text-sm font-semibold">Preview unavailable</p><p className="mt-2 max-w-xs text-xs leading-5 text-white/55">The secure file could not be displayed here. Download it to continue the review.</p></div>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onDownload} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white transition-[background-color,transform] hover:bg-white/15 active:scale-[0.96]"><Download size={14} /> Download proof</button>{previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#B9D7FF] transition-[background-color,transform] hover:bg-white/10 active:scale-[0.96]"><Maximize2 size={14} /> Open full size</a>}</div>
        </section>
        <section className="thin-scroll overflow-y-auto bg-white p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-canvas p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"><p className="text-[11px] text-muted">Declared purchase</p><p className="number mt-1 text-xl font-semibold tracking-[-0.03em] text-ink">{formatCurrency(item.amount)}</p></div><div className="rounded-xl bg-soft-blue p-4 shadow-[inset_0_0_0_1px_rgba(79,111,174,0.16)]"><p className="text-[11px] text-navy">Total expected payout</p><p className="number mt-1 text-xl font-semibold tracking-[-0.03em] text-navy">{formatCurrency(item.expectedPayout)}</p></div></div>
          <div className="mt-5"><p className="eyebrow">Payout breakdown</p><div className="mt-2 divide-y divide-line rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"><InfoRow label="Expected reimbursement" value={formatCurrency(item.reimbursement)} /><InfoRow label="Incentive" value={`+${formatCurrency(item.incentive)}`} valueClass="text-success" /><InfoRow label="Detected amount" value={item.detectedAmount === null || item.detectedAmount === undefined ? '—' : formatCurrency(item.detectedAmount)} /><InfoRow label="Amount matching" value={item.amountMatches === true ? 'Match' : item.amountMatches === false ? 'Mismatch' : 'Not checked'} valueClass={item.amountMatches === true ? 'text-success' : item.amountMatches === false ? 'text-error' : 'text-muted'} /></div></div>
          <div className="mt-5"><p className="eyebrow">Verification details</p><div className="mt-2 divide-y divide-line rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"><InfoRow label="Purchase date & time" value={`${item.purchaseDate || '—'}${item.purchaseTime ? ` · ${item.purchaseTime}` : ''}`} /><InfoRow label="Transaction reference" value={item.transactionReference || '—'} /><div className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-xs text-muted">Automation confidence</span><StatusBadge tone={confidenceTone} dot>{item.confidence}</StatusBadge></div></div></div>
          {item.warnings.length > 0 && <div className="mt-5 rounded-xl bg-[#FFFBEB] p-4 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.22)]"><div className="flex items-center gap-2 text-xs font-semibold text-warning"><ShieldAlert size={15} /> Verification warnings</div><div className="mt-2 space-y-1 text-xs leading-5 text-[#8A5609]">{item.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}
          {item.userNote && <div className="mt-5"><p className="eyebrow">Member note</p><p className="mt-2 rounded-xl bg-canvas p-4 text-xs leading-5 text-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">{item.userNote}</p></div>}
          {canDecide && <><label className="mt-5 block text-xs font-semibold text-ink">Reviewer note <span className="font-normal text-muted">{pendingDecision && pendingDecision !== 'Approved' ? '(required)' : '(optional for approval)'}</span><textarea className="form-field mt-2 h-24 resize-y py-3" value={note} onChange={(event) => { setNote(event.target.value); setValidationMessage('') }} placeholder="Explain the decision to the member..." /></label>
          {validationMessage && <p className="mt-2 text-xs font-medium text-error" role="alert">{validationMessage}</p>}</>}
        </section>
      </div>
      <footer className="shrink-0 border-t border-line bg-white px-4 py-3 sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted">{canDecide ? 'Review the proof and server-recorded values before deciding.' : 'This submission has a recorded decision and is available for review only.'}</p>{canDecide && <div className="flex flex-col-reverse gap-2 sm:flex-row"><button disabled={busy} onClick={() => requestDecision('Request changes')} className="btn-secondary border-[#F4D7A6] text-warning hover:bg-[#FFFBEB]"><RefreshCw size={15} /> Request changes</button><button disabled={busy} onClick={() => requestDecision('Rejected')} className="btn-secondary border-[#F4B7B7] text-error hover:bg-[#FEF2F2]"><X size={15} /> Reject</button><button disabled={busy} onClick={() => requestDecision('Approved')} className="btn-primary bg-success hover:bg-[#12863C]"><Check size={15} /> Approve</button></div>}</div></footer>
      {canDecide && pendingDecision && <DecisionConfirmationDialog decision={pendingDecision} busy={busy} onCancel={() => setPendingDecision(null)} onConfirm={() => void confirmDecision()} />}
    </div>
  )
}

function DecisionConfirmationDialog({ decision, busy, onCancel, onConfirm }: { decision: 'Approved' | 'Request changes' | 'Rejected'; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  const destructive = decision === 'Rejected'
  const approval = decision === 'Approved'
  return createPortal(
    <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }} className="m-auto w-[calc(100%-32px)] max-w-md rounded-[20px] bg-white p-0 text-left shadow-[0_28px_90px_rgba(15,29,51,0.38)] backdrop:bg-[#10192B]/55 backdrop:backdrop-blur-[3px]" aria-labelledby="decision-confirmation-title" aria-describedby="decision-confirmation-description">
      <div className="p-5 sm:p-6"><span className={`grid h-11 w-11 place-items-center rounded-xl ${destructive ? 'bg-[#FEF2F2] text-error' : approval ? 'bg-[#ECFDF3] text-success' : 'bg-[#FFF7ED] text-warning'}`}>{destructive ? <X size={20} /> : approval ? <Check size={20} /> : <RefreshCw size={20} />}</span><h3 id="decision-confirmation-title" className="mt-4 text-lg font-semibold tracking-[-0.03em] text-ink">Confirm {decision.toLowerCase()}?</h3><p id="decision-confirmation-description" className="mt-2 text-sm leading-6 text-muted">This updates the submission workflow and notifies the member. The action only completes after the server confirms it.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={onCancel} className="btn-secondary">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className={destructive ? 'btn-primary bg-error hover:bg-[#B42318]' : approval ? 'btn-primary bg-success hover:bg-[#12863C]' : 'btn-primary'}>{busy ? 'Saving…' : `Confirm ${decision.toLowerCase()}`}</button></div></div>
    </dialog>,
    document.body,
  )
}

function InfoRow({ label, value, valueClass = 'text-ink' }: { label: string; value: string; valueClass?: string }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-3"><span className="text-xs text-muted">{label}</span><span className={`number max-w-[58%] break-words text-right text-xs font-semibold ${valueClass}`}>{value}</span></div>
}

function AdminPayoutsPage({ onToast, onRefresh }: { onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const { runOperation, processing, notify } = useFeedback()
  const [filter, setFilter] = useState('All')
  const rows = adminPayouts
  const filtered = filter === 'All' ? rows : rows.filter((row) => row.status === filter)
  const reconcilePayout = (id: string) => {
    void updateStatus(id, 'sync')
  }
  const updateStatus = async (id: string, action: 'process' | 'retry' | 'sync') => {
    const row = rows.find((item) => item.id === id)
    const backendId = row?.backendId
    if (!backendId) {
      onToast('This payout is not connected to a backend record.')
      return
    }
    const label = action === 'retry' ? 'Preparing payout retry' : action === 'process' ? 'Releasing payout' : 'Reconciling payout'
    await runOperation({ title: label, description: action === 'process' ? 'Queueing this approved payout for Airwallex processing.' : 'Refreshing the authoritative provider status without creating another transfer.', successMessage: action === 'retry' ? `${id} is ready for release.` : action === 'process' ? `${id} queued for processing.` : `${id} reconciled.` }, async () => {
      if (action === 'retry') {
        await api.retryPayout(backendId)
        try { await onRefresh() } catch { notify('Retry queued successfully, but the payout ledger could not refresh. Reload to see the latest status.', 'warning') }
        return
      }
      if (action === 'process') await api.processPayout(backendId)
      else await api.syncPayout(backendId)
      try { await onRefresh() } catch { notify('Payout status updated, but the ledger could not refresh. Reload to see the latest status.', 'warning') }
    })
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Money operations" title="Payout management" description="Move approved rewards through processing and keep a clear record of recorded payouts." />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Approved payouts" value={adminStats.approvedPayouts} helper="Currently approved" icon={Clock3} tone="orange" /><StatCard label="Processing" value={adminStats.processingPayouts} helper="Currently in progress" icon={RefreshCw} tone="blue" /><StatCard label="Total paid" value={adminStats.totalPaid} helper="Recorded paid payouts" icon={CircleDollarSign} tone="green" /></div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">Payout ledger</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Approved rewards</h2></div><div className="thin-scroll flex gap-1 overflow-x-auto">{['All', 'Approved', 'Processing', 'Paid', 'Failed'].map((item) => <button key={item} onClick={() => setFilter(item)} className={'min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold ' + (filter === item ? 'bg-soft-blue text-navy' : 'text-muted hover:bg-canvas')}>{item}</button>)}</div></div>
    {filtered.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Payout</th><th className="px-4 py-3 font-semibold">Member / task</th><th className="px-4 py-3 font-semibold">Reimbursement</th><th className="px-4 py-3 font-semibold">Incentive</th><th className="px-4 py-3 font-semibold">Total</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((row) => <tr key={row.id} className="transition-colors hover:bg-canvas"><td className="px-6 py-4 text-xs font-semibold text-navy">{row.id}<p className="mt-1 font-normal text-subtle">{row.date}</p></td><td className="px-4 py-4"><p className="text-sm font-semibold text-ink">{row.member}</p><p className="mt-1 text-[11px] text-muted">{row.task}</p></td><td className="number px-4 py-4 text-xs text-ink">{formatCurrency(row.reimbursement)}</td><td className="number px-4 py-4 text-xs text-success">+{formatCurrency(row.incentive)}</td><td className="number px-4 py-4 text-sm font-semibold text-navy">{formatCurrency(row.total)}</td><td className="px-4 py-4"><StatusBadge tone={getTone(row.status)} dot>{row.status}</StatusBadge></td><td className="px-6 py-4 text-right">{row.status === 'Approved' ? <button disabled={processing} onClick={() => void updateStatus(row.id, 'process')} className="btn-primary min-h-9 px-3 text-xs disabled:opacity-60">Process payout</button> : row.status === 'Processing' ? <button disabled={processing} onClick={() => reconcilePayout(row.id)} className="btn-secondary min-h-9 px-3 text-xs disabled:opacity-60">Sync status</button> : row.status === 'Failed' || row.status === 'Payout Failed' ? <button disabled={processing} onClick={() => void updateStatus(row.id, 'retry')} className="btn-secondary min-h-9 px-3 text-xs disabled:opacity-60">Retry</button> : <button onClick={() => onToast(row.reference === '—' ? 'No provider reference is recorded.' : `${row.id} · ${row.reference}`)} className="btn-ghost min-h-9 px-2.5 text-xs">View reference</button>}</td></tr>)}</tbody></table></div>
    <div className="divide-y divide-line md:hidden">{filtered.map((row) => <div key={row.id} className="space-y-3 px-5 py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-navy">{row.id}</p><p className="mt-1 text-sm font-semibold text-ink">{row.member}</p><p className="mt-1 text-[11px] text-muted">{row.task} · {row.date}</p></div><StatusBadge tone={getTone(row.status)}>{row.status}</StatusBadge></div><div className="flex items-center justify-between border-t border-line pt-3"><p className="number text-sm font-semibold text-navy">{formatCurrency(row.total)} <span className="text-[11px] font-normal text-muted">total</span></p>{row.status === 'Approved' ? <button disabled={processing} onClick={() => void updateStatus(row.id, 'process')} className="btn-primary min-h-9 px-3 text-xs disabled:opacity-60">Process</button> : row.status === 'Processing' ? <button disabled={processing} onClick={() => reconcilePayout(row.id)} className="btn-secondary min-h-9 px-3 text-xs disabled:opacity-60">Sync status</button> : row.status === 'Failed' || row.status === 'Payout Failed' ? <button disabled={processing} onClick={() => void updateStatus(row.id, 'retry')} className="btn-secondary min-h-9 px-3 text-xs disabled:opacity-60">Retry</button> : <button onClick={() => onToast(row.reference === '—' ? 'No provider reference is recorded.' : `${row.id} · ${row.reference}`)} className="btn-ghost min-h-9 px-2 text-xs">Reference</button>}</div></div>)}</div></> : <TableEmpty message={rows.length ? 'No payouts match this status.' : 'No payouts yet.'} />}</section>
  </div>
}
function AdminFaqsPage({ onToast }: { onToast: (message: string) => void }) {
  const { runOperation, processing } = useFeedback()
  const [items, setItems] = useState<ApiFaq[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ApiFaq | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [preview, setPreview] = useState<ApiFaq | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [category, setCategory] = useState('General')
  const [published, setPublished] = useState(false)
  const [sortOrder, setSortOrder] = useState('')
  const load = async (search = query) => {
    setLoading(true)
    try { setItems((await api.adminFaqs(search.trim() ? { search: search.trim() } : {})).data) }
    catch (error) { onToast(error instanceof Error ? error.message : 'FAQs could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load('') }, [])
  const startCreate = () => { setEditing(null); setQuestion(''); setAnswer(''); setCategory('General'); setPublished(false); setSortOrder(String(items.length + 1)); setFormOpen(true) }
  const startEdit = (faq: ApiFaq) => { setEditing(faq); setQuestion(faq.question); setAnswer(faq.answer); setCategory(faq.category || 'General'); setPublished(Boolean(faq.is_published)); setSortOrder(String(faq.sort_order ?? 0)); setFormOpen(true) }
  const save = async () => {
    if (!question.trim() || !answer.trim()) { onToast('Enter a question and an answer.'); return }
    await runOperation({ title: editing ? 'Updating FAQ' : 'Creating FAQ', description: 'Saving the public answer to the FAQ catalog.', successMessage: editing ? 'FAQ updated.' : 'FAQ created.' }, async () => {
      const payload = { question: question.trim(), answer: answer.trim(), category: category.trim() || null, is_published: published, sort_order: Number(sortOrder) || 0 }
      if (editing) await api.adminUpdateFaq(editing.id, payload)
      else await api.adminCreateFaq(payload)
        setEditing(null)
        setFormOpen(false)
      await load()
    })
  }
  const togglePublished = async (faq: ApiFaq) => {
    try { await api.adminUpdateFaq(faq.id, { is_published: !faq.is_published }); await load(); onToast(!faq.is_published ? 'FAQ published.' : 'FAQ unpublished.') }
    catch (error) { onToast(error instanceof Error ? error.message : 'FAQ visibility could not be changed.') }
  }
  const remove = async (faq: ApiFaq) => {
    if (!window.confirm(`Delete “${faq.question}”? This removes it from the public FAQ.`)) return
    try { await api.adminDeleteFaq(faq.id); await load(); onToast('FAQ deleted.') }
    catch (error) { onToast(error instanceof Error ? error.message : 'FAQ could not be deleted.') }
  }
  const move = async (faq: ApiFaq, delta: -1 | 1) => {
    const index = items.findIndex((item) => item.id === faq.id)
    const targetIndex = index + delta
    if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return
    const updated = [...items]
    const [moved] = updated.splice(index, 1)
    updated.splice(targetIndex, 0, moved)
    try {
      for (let order = 0; order < updated.length; order += 1) await api.adminUpdateFaq(updated[order].id, { sort_order: order + 1 })
      await load()
    } catch (error) { onToast(error instanceof Error ? error.message : 'FAQ order could not be saved.') }
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Public content" title="FAQ management" description="Create, preview, publish, and reorder the answers shown on the public site." actions={<button onClick={startCreate} className="btn-primary"><Plus size={16} /> Create FAQ</button>} />
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">Published content</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">FAQ entries</h2></div><label className="relative w-full sm:max-w-[280px]"><span className="sr-only">Search FAQs</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><input value={query} onChange={(event) => { setQuery(event.target.value); void load(event.target.value) }} className="form-field h-10 pl-9 text-xs" placeholder="Search questions, answers or category" /></label></div>
      {items.length ? <div className="divide-y divide-line">{items.map((faq, index) => <article key={faq.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:px-6"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-ink">{faq.question}</p><StatusBadge tone={faq.is_published ? 'success' : 'neutral'}>{faq.is_published ? 'Published' : 'Draft'}</StatusBadge></div><p className="mt-1 text-[11px] text-muted">{faq.category || 'General'} · Order {faq.sort_order ?? index + 1}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{faq.answer}</p></div><div className="flex shrink-0 flex-wrap gap-1"><button onClick={() => setPreview(faq)} className="btn-ghost min-h-9 px-2.5 text-xs"><Eye size={14} /> Preview</button><button onClick={() => startEdit(faq)} className="btn-secondary min-h-9 px-2.5 text-xs"><Pencil size={14} /> Edit</button><button onClick={() => void togglePublished(faq)} className="btn-ghost min-h-9 px-2.5 text-xs">{faq.is_published ? 'Unpublish' : 'Publish'}</button><button onClick={() => void move(faq, -1)} disabled={Boolean(query) || index === 0} aria-label="Move FAQ up" className="btn-ghost min-h-9 px-2 disabled:opacity-40"><ArrowUp size={14} /></button><button onClick={() => void move(faq, 1)} disabled={Boolean(query) || index === items.length - 1} aria-label="Move FAQ down" className="btn-ghost min-h-9 px-2 disabled:opacity-40"><ArrowDown size={14} /></button><button onClick={() => void remove(faq)} className="btn-ghost min-h-9 px-2.5 text-xs text-error"><Trash2 size={14} /> Delete</button></div></article>)}</div> : <TableEmpty message={loading ? 'Loading FAQs…' : 'No FAQ entries match your search.'} />}
    </section>
    <Modal open={formOpen} title={editing ? 'Edit FAQ' : 'Create FAQ'} description="Answers are rendered as plain text on the public site; HTML is never executed." onClose={() => setFormOpen(false)} size="lg"><div className="space-y-4"><label className="block text-xs font-semibold text-ink">Question<input autoFocus maxLength={240} value={question} onChange={(event) => setQuestion(event.target.value)} className="form-field mt-2" /></label><div className="grid gap-4 sm:grid-cols-[1fr_120px]"><label className="block text-xs font-semibold text-ink">Category<input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} className="form-field mt-2" /></label><label className="block text-xs font-semibold text-ink">Order<input type="number" min="0" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="form-field mt-2" /></label></div><label className="block text-xs font-semibold text-ink">Answer<textarea maxLength={10000} value={answer} onChange={(event) => setAnswer(event.target.value)} className="form-field mt-2 min-h-40 py-3" /></label><label className="flex items-center gap-2 text-xs font-medium text-ink"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publish this answer on the public site</label><div className="flex justify-end gap-2 border-t border-line pt-4"><button onClick={() => setFormOpen(false)} className="btn-secondary">Cancel</button><button disabled={processing || !question.trim() || !answer.trim()} onClick={() => void save()} className="btn-primary disabled:opacity-50">{processing ? 'Saving…' : 'Save FAQ'} <Check size={15} /></button></div></div></Modal>
    <Modal open={Boolean(preview)} title="FAQ preview" description="This is how the saved text will appear on the public site." onClose={() => setPreview(null)}><div className="rounded-xl border border-line bg-white p-5"><p className="text-base font-semibold text-ink">{preview?.question}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{preview?.answer}</p></div></Modal>
  </div>
}

function AdminGenericPage({ page, onToast }: { page: AppPage; onToast: (message: string) => void }) {
  if (page === 'admin-users') return <AdminUsersPage />
  if (page === 'admin-transactions') return <AdminTransactionsPage />
  if (page === 'admin-notifications') return <AdminNotificationsPage />
  return <><AdminSettingsPage onToast={onToast} /><AirwallexSettingsCard onToast={onToast} /><EmailSettingsCard onToast={onToast} />{import.meta.env.VITE_CLIENT_PREVIEW === 'true' && <DemoDataPanel onToast={onToast} />}</>
}

function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const filtered = members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase()))
  const activeCount = members.filter((member) => member.status.toLowerCase() === 'active').length
  return <div className="space-y-7"><PageHeader eyebrow="Member management" title="Users" description="Review member accounts and the task and earnings information returned by the admin API." /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Loaded members" value={String(members.length)} helper="In the current API response" icon={UsersRound} tone="navy" /><StatCard label="Active in loaded list" value={String(activeCount)} helper="Accounts marked active" icon={UserCheck} tone="green" /><StatCard label="Tasks completed" value={String(members.reduce((sum, member) => sum + member.tasks, 0))} helper="Across loaded members" icon={ClipboardCheck} tone="blue" /></div><section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="eyebrow">Member directory</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Members</h2></div><div className="relative w-full sm:max-w-[260px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-field h-9 pl-9 text-xs" placeholder="Search loaded members" /></div></div>{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Tasks completed</th><th className="px-4 py-3 font-semibold">Total earned</th><th className="px-6 py-3 text-right font-semibold">Status</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((member) => <tr key={member.email} className="transition-colors hover:bg-canvas"><td className="px-6 py-4"><div className="flex items-center gap-3"><Avatar initials={member.initials} size="sm" tone="blue" /><div><p className="text-sm font-semibold text-ink">{member.name}</p><p className="mt-1 text-[11px] text-muted">{member.email}</p></div></div></td><td className="px-4 py-4 text-xs font-semibold text-ink">{member.tasks}</td><td className="number px-4 py-4 text-xs font-semibold text-navy">{formatCurrency(member.earned)}</td><td className="px-6 py-4 text-right"><StatusBadge tone={getTone(member.status)} dot>{member.status}</StatusBadge></td></tr>)}</tbody></table></div> : <TableEmpty message={members.length ? 'No members match your search.' : 'No member records were returned.'} />}</section></div>
}

function AdminReferralsPage({ onToast, onRefresh, onNavigate }: { onToast: (message: string) => void; onRefresh: () => Promise<void>; onNavigate: (page: AppPage) => void }) {
  const { runOperation, processing } = useFeedback()
  const [items, setItems] = useState<ApiAdminReferral[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<Awaited<ReturnType<typeof api.adminReferral>>['data'] | null>(null)
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false)
  const [manualReference, setManualReference] = useState('')
  const [manualNote, setManualNote] = useState('')

  const load = async (status = filter, search = appliedQuery) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (status !== 'all' && status !== 'review') params.status = status
      if (status === 'review') params.needs_review = 'true'
      if (search.trim()) params.search = search.trim()
      const response = await api.adminReferrals(params)
      setItems(response.data.items)
      setSummary(response.data.summary)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Referral records could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load('all', '') }, [])

  const openReferral = async (id: number) => {
    try {
      const response = await api.adminReferral(id)
      setDetails(response.data)
      setManualPaymentOpen(false)
      setManualReference('')
      setManualNote('')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Referral details could not be loaded.')
    }
  }

  const refreshReferral = async (id: number) => {
    await load()
    try { setDetails((await api.adminReferral(id)).data) } catch { setDetails(null) }
    try { await onRefresh() } catch { /* Preserve the successful review action if an unrelated dashboard refresh fails. */ }
  }

  const approve = async (item: ApiAdminReferral) => {
    if (item.review_unresolved) { onToast('Resolve the possible duplicate account review before approving this reward.'); return }
    const note = window.prompt('Optional approval note for the audit record:') || ''
    await runOperation({ title: 'Approving referral reward', description: 'Create the approved reward in the existing payout queue.', successMessage: 'Referral reward approved and added to payouts.' }, async () => {
      await api.adminApproveReferral(item.id, note.trim() || undefined)
      await refreshReferral(item.id)
    })
  }

  const hold = async (item: ApiAdminReferral) => {
    const reason = window.prompt('Why is this referral reward being held?')
    if (!reason?.trim()) return
    await runOperation({ title: 'Holding referral reward', description: 'Record the reason and pause approval.', successMessage: 'Referral reward held for review.' }, async () => {
      await api.adminHoldReferral(item.id, reason.trim())
      await refreshReferral(item.id)
    })
  }

  const resolveReview = async (item: ApiAdminReferral) => {
    const reason = window.prompt('Add the review outcome and reason for resolving this account match:')
    if (!reason?.trim()) return
    await runOperation({ title: 'Resolving account match', description: 'Record an administrator decision on the possible duplicate account.', successMessage: 'Referral account review resolved.' }, async () => {
      await api.adminResolveReferralReview(item.id, reason.trim())
      await refreshReferral(item.id)
    })
  }

  const markManuallyPaid = async () => {
    if (!details?.payout || !manualReference.trim() || !manualNote.trim()) return
    await runOperation({ title: 'Recording manual payout', description: 'Save the payment reference and administrator note to the existing payout record.', successMessage: 'Manual referral payout recorded as paid.' }, async () => {
      await api.adminMarkPayoutPaid(details.payout!.id, manualReference.trim(), manualNote.trim())
      setManualPaymentOpen(false)
      await refreshReferral(details.id)
    })
  }

  const filters = [
    ['all', 'All'],
    ['pending_approval', 'Pending approval'],
    ['held', 'On hold'],
    ['approved', 'Awaiting payout'],
    ['payout_failed', 'Payout failed'],
    ['paid', 'Paid'],
    ['review', 'Possible matches'],
  ]
  const formattedDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : '—'

  return <div className="space-y-7">
    <PageHeader eyebrow="Growth operations" title="Referral activity" description="Review one-time rewards after a referred member’s first approved task, and follow each payout through the existing payout ledger." actions={<button onClick={() => onNavigate('admin-payouts')} className="btn-secondary"><WalletCards size={15} /> Open payout ledger</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total referrals" value={String(summary.total ?? adminStats.referralTotals)} helper="All attributed members" icon={UsersRound} tone="navy" />
      <StatCard label="Awaiting decision" value={String(summary.pending_approval ?? adminStats.pendingReferralApprovals)} helper="Qualified once on first approved task" icon={Clock3} tone="orange" />
      <StatCard label="Possible account matches" value={String(summary.suspicious ?? adminStats.duplicatePayoutDetails)} helper="Needs administrator review" icon={ShieldAlert} tone="orange" />
      <StatCard label="Rewards paid" value={formatCurrency(summary.paid_amount ?? 0)} helper="Confirmed payout ledger total" icon={CircleDollarSign} tone="green" />
    </div>
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div><p className="eyebrow">Referral records</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Qualification and reward status</h2></div>
        <form onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query); void load(filter, query) }} className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search referrals</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="form-field h-10 pl-9 text-xs" placeholder="Search names or email addresses" /></label>
          <button type="submit" className="btn-secondary min-h-10">Search</button>
          <select aria-label="Filter referral records" value={filter} onChange={(event) => { setFilter(event.target.value); void load(event.target.value) }} className="form-field min-h-10 sm:w-[190px]">{filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </form>
      </div>
      {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left">
        <thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-subtle"><tr><th className="px-6 py-3 font-semibold">Referrer</th><th className="px-4 py-3 font-semibold">Referred member</th><th className="px-4 py-3 font-semibold">First approved task</th><th className="px-4 py-3 font-semibold">Reward</th><th className="px-4 py-3 font-semibold">Reward / payout</th><th className="px-6 py-3 text-right font-semibold">Review</th></tr></thead>
        <tbody className="divide-y divide-line">{items.map((item) => <tr key={item.id} className="transition-colors hover:bg-canvas">
          <td className="px-6 py-4"><p className="text-sm font-semibold text-ink">{item.referrer || '—'}</p><p className="mt-1 text-[11px] text-muted">{item.referrer_email || ''}</p></td>
          <td className="px-4 py-4"><p className="text-sm font-medium text-ink">{item.referred_user || '—'}</p><p className="mt-1 text-[11px] text-muted">{item.referred_email || ''}</p></td>
          <td className="px-4 py-4"><p className="text-xs text-ink">{item.qualifying_task || 'Not qualified yet'}</p><p className="mt-1 text-[11px] text-muted">{formattedDate(item.qualified_at || item.registered_at)}</p></td>
          <td className="number px-4 py-4 text-sm font-semibold text-navy">{formatCurrency(item.reward)}</td>
          <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5"><StatusBadge tone={getTone(item.reward_status)} dot>{item.reward_status.replace(/_/g, ' ')}</StatusBadge>{item.payout_status && <StatusBadge tone={getTone(item.payout_status)}>{item.payout_status.replace(/_/g, ' ')}</StatusBadge>}{item.review_unresolved && <StatusBadge tone="warning">Possible match</StatusBadge>}</div></td>
          <td className="px-6 py-4 text-right"><div className="flex justify-end gap-1.5"><button onClick={() => void openReferral(item.id)} className="btn-secondary min-h-9 px-2.5 text-xs"><Eye size={14} /> Details</button>{item.qualification_status === 'qualified' && ['pending_approval', 'held'].includes(item.reward_status) && <><button disabled={processing || item.review_unresolved} onClick={() => void approve(item)} className="btn-primary min-h-9 px-2.5 text-xs disabled:opacity-50"><Check size={14} /> Approve</button><button disabled={processing} onClick={() => void hold(item)} className="btn-ghost min-h-9 px-2.5 text-xs">Hold</button></>}</div></td>
        </tr>)}</tbody></table></div> : <TableEmpty message={loading ? 'Loading referral records…' : 'No referral records match this filter.'} />}
    </section>
    <Modal open={Boolean(details)} title="Referral details" description="Qualification, review decisions, and payout references from the existing ledger." onClose={() => { setDetails(null); setManualPaymentOpen(false) }} size="lg">
      {details && <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-canvas p-4"><p className="eyebrow">Referrer</p><p className="mt-2 text-sm font-semibold text-ink">{details.referrer || '—'}</p><p className="mt-1 text-xs text-muted">{details.referrer_email || ''}</p></div><div className="rounded-xl bg-canvas p-4"><p className="eyebrow">Referred member</p><p className="mt-2 text-sm font-semibold text-ink">{details.referred_user || '—'}</p><p className="mt-1 text-xs text-muted">{details.referred_email || ''}</p></div></div>
        <div className="grid gap-3 sm:grid-cols-3"><div><p className="eyebrow">Reward</p><p className="number mt-1 text-lg font-semibold text-navy">{formatCurrency(details.reward)}</p></div><div><p className="eyebrow">Reward state</p><p className="mt-1 text-sm font-semibold capitalize text-ink">{details.reward_status.replace(/_/g, ' ')}</p></div><div><p className="eyebrow">Decision maker</p><p className="mt-1 text-sm text-ink">{details.decided_by || 'Not decided'}</p></div></div>
        <section className="rounded-xl border border-line p-4"><p className="eyebrow">First qualifying purchase</p>{details.qualifying_purchase ? <div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-[11px] text-muted">Task</p><p className="mt-1 text-sm font-semibold text-ink">{details.qualifying_purchase.task || 'Task'}</p></div><div><p className="text-[11px] text-muted">Purchase amount</p><p className="number mt-1 text-sm font-semibold text-ink">{formatCurrency(details.qualifying_purchase.purchase_amount)}</p></div><div><p className="text-[11px] text-muted">Approved</p><p className="mt-1 text-sm text-ink">{formattedDate(details.qualifying_purchase.approved_at)}</p></div></div> : <p className="mt-2 text-sm text-muted">The referred member has not completed a qualifying approved task.</p>}</section>
        {details.possible_duplicate_account && <section className="rounded-xl border border-[#F5D7A8] bg-[#FFF9ED] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Possible duplicate account</p><p className="mt-1 text-xs leading-5 text-muted">{details.review_note || 'Matching payout identifiers require administrator review. This signal is not a fraud determination.'}</p></div><StatusBadge tone={details.review_unresolved ? 'warning' : 'success'}>{details.review_unresolved ? 'Review required' : 'Resolved'}</StatusBadge></div>{details.review_unresolved && <button disabled={processing} onClick={() => void resolveReview(details)} className="btn-secondary mt-3 min-h-9 text-xs">Record review outcome</button>}</section>}
        <section className="rounded-xl border border-line p-4"><div className="flex items-center justify-between"><div><p className="eyebrow">Payout record</p><p className="mt-1 text-xs text-muted">Reward payments use the Click & Earn payout ledger.</p></div>{details.payout && <button onClick={() => onNavigate('admin-payouts')} className="btn-ghost min-h-9 text-xs">Open payout ledger</button>}</div>
          {details.payout ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-[11px] text-muted">Payout status</p><p className="mt-1 text-sm font-semibold capitalize text-ink">{details.payout.status.replace(/_/g, ' ')}</p></div><div><p className="text-[11px] text-muted">Payout amount</p><p className="number mt-1 text-sm font-semibold text-navy">{formatCurrency(details.payout.amount)} {details.payout.currency}</p></div><div><p className="text-[11px] text-muted">Reference</p><p className="mt-1 break-all text-xs text-ink">{details.payout.manual_reference || details.payout.provider_reference || 'No reference recorded'}</p></div><div><p className="text-[11px] text-muted">Paid at</p><p className="mt-1 text-xs text-ink">{formattedDate(details.payout.paid_at)}</p></div></div> : <p className="mt-3 text-sm text-muted">No payout has been created for this referral yet.</p>}
          {details.payout && details.payout.status !== 'paid' && !['cancelled', 'reversed'].includes(details.payout.status) && <div className="mt-4 border-t border-line pt-4"><button onClick={() => setManualPaymentOpen((open) => !open)} className="btn-secondary min-h-9 text-xs"><CheckCircle2 size={14} /> Record confirmed manual payment</button>{manualPaymentOpen && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">Payment reference<input maxLength={160} value={manualReference} onChange={(event) => setManualReference(event.target.value)} className="form-field mt-2" /></label><label className="text-xs font-semibold text-ink">Audit note<textarea maxLength={2000} value={manualNote} onChange={(event) => setManualNote(event.target.value)} className="form-field mt-2 min-h-11 py-2" /></label><p className="text-[11px] leading-5 text-muted sm:col-span-2">Only use this after the transfer has been confirmed. Saving records the administrator, reference, and note against the existing payout.</p><div className="flex justify-end gap-2 sm:col-span-2"><button onClick={() => setManualPaymentOpen(false)} className="btn-ghost min-h-9 text-xs">Cancel</button><button disabled={processing || !manualReference.trim() || !manualNote.trim()} onClick={() => void markManuallyPaid()} className="btn-primary min-h-9 text-xs disabled:opacity-50">{processing ? 'Recording…' : 'Record payment'}</button></div></div>}</div>}
        </section>
        {details.reward_hold_reason && <div className="rounded-xl bg-[#FFF7ED] p-4"><p className="text-xs font-semibold text-ink">Hold reason</p><p className="mt-1 text-xs leading-5 text-muted">{details.reward_hold_reason}</p></div>}
        {details.history?.length ? <section><p className="eyebrow">Audit history</p><div className="mt-2 divide-y divide-line rounded-xl border border-line">{details.history.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"><div><p className="text-xs font-semibold text-ink">{entry.action.replace(/\\./g, ' ')}</p><p className="mt-1 text-[11px] text-muted">{entry.actor || 'System'}</p></div><span className="text-[11px] text-subtle">{formattedDate(entry.created_at)}</span></div>)}</div></section> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">{details.qualification_status === 'qualified' && ['pending_approval', 'held'].includes(details.reward_status) && <><button disabled={processing} onClick={() => void hold(details)} className="btn-secondary min-h-10">Hold reward</button><button disabled={processing || details.review_unresolved} onClick={() => void approve(details)} className="btn-primary min-h-10 disabled:opacity-50">Approve reward <ArrowRight size={15} /></button></>}</div>
      </div>}
    </Modal>
  </div>
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

function AirwallexSettingsCard({ onToast }: { onToast: (message: string) => void }) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.adminAirwallexStatus>>['data'] | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmLive, setConfirmLive] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const load = async () => {
    try { setStatus((await api.adminAirwallexStatus()).data) } catch (error) { onToast(error instanceof Error ? error.message : 'Airwallex settings could not be loaded.') }
  }
  useEffect(() => { void load() }, [])
  const testConnection = async (environment: 'sandbox' | 'live') => {
    setBusy(true)
    try { const result = await api.adminTestAirwallexConnection(environment); onToast(`${environment === 'live' ? 'Live' : 'Sandbox'}: ${result.data.status.replace(/_/g, ' ')}.`); await load() } catch (error) { onToast(error instanceof Error ? error.message : 'Connection test failed.') } finally { setBusy(false) }
  }
  const activate = async (environment: 'sandbox' | 'live') => {
    setBusy(true)
    try { await api.adminSetAirwallexEnvironment(environment, environment === 'live' ? confirmation : undefined); setConfirmLive(false); setConfirmation(''); await load(); onToast(`Airwallex ${environment} mode is active.`) } catch (error) { onToast(error instanceof Error ? error.message : 'Environment could not be changed.') } finally { setBusy(false) }
  }
  const card = (environment: 'sandbox' | 'live') => {
    const item = status?.[environment]
    const active = status?.active_environment === environment
    return <div className={`rounded-xl border p-4 ${active ? environment === 'sandbox' ? 'border-[#93C5FD] bg-[#EFF6FF]' : 'border-[#F4B7B7] bg-[#FEF2F2]' : 'border-line bg-canvas'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-ink">{environment === 'sandbox' ? 'Sandbox' : 'Live'}</p><p className="mt-1 text-[11px] text-muted break-all">{item?.base_url || 'Unavailable'}</p></div>{active && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] ${environment === 'sandbox' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-error'}`}>{environment.toUpperCase()} MODE</span>}</div><div className="mt-4 grid gap-2 text-[11px] text-muted"><p>Credentials: <strong className="text-ink">{item?.credentials_configured ? 'Configured' : 'Not configured'}</strong></p><p>Webhook: <strong className="text-ink">{item?.webhook_configured ? 'Configured' : 'Not configured'}</strong></p><p>Connection: <strong className="text-ink">{item?.connection?.replace(/_/g, ' ') || 'Checking'}</strong></p></div><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void testConnection(environment)} className="btn-secondary min-h-10 text-xs disabled:opacity-60">Test connection</button>{!active && <button disabled={busy || (environment === 'live' && !status?.readiness.ready)} onClick={() => environment === 'live' ? setConfirmLive(true) : void activate('sandbox')} className="btn-primary min-h-10 text-xs disabled:opacity-60">Use {environment}</button>}</div></div>
  }
  return <><section className="card mx-auto max-w-[1240px] p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Payout infrastructure</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Airwallex environments</h2><p className="mt-1 text-xs leading-5 text-muted">Credentials and webhook secrets remain on the server. Releasing a payout is always a separate admin action.</p></div>{status?.active_environment === 'sandbox' && <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-blue-700">SANDBOX MODE</span>}</div>{status?.active_environment === 'sandbox' && <div className="mt-4 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-xs text-blue-800">Airwallex Sandbox — no real money will be transferred.</div>}<div className="mt-5 grid gap-4 lg:grid-cols-2">{card('sandbox')}{card('live')}</div>{status && !status.readiness.ready && <div className="mt-4 rounded-xl border border-[#F4B7B7] bg-[#FEF2F2] p-3 text-xs text-error"><strong>Live readiness blocked.</strong><ul className="mt-2 list-disc space-y-1 pl-4">{status.readiness.failed_checks.map((check) => <li key={check}>{check}</li>)}</ul></div>}</section><Modal open={confirmLive} title="Confirm Live Airwallex mode" description="Live Airwallex payouts can transfer real money. Type LIVE only after reviewing every readiness check." onClose={() => { if (!busy) setConfirmLive(false) }} size="sm"><div className="space-y-4"><label className="block text-xs font-semibold text-ink">Type LIVE<input autoComplete="off" className="form-field mt-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><div className="flex justify-end gap-2"><button disabled={busy} onClick={() => setConfirmLive(false)} className="btn-secondary">Cancel</button><button disabled={busy || confirmation !== 'LIVE'} onClick={() => void activate('live')} className="btn-primary disabled:opacity-60">Confirm Live Mode</button></div></div></Modal></>
}

function EmailSettingsCard({ onToast }: { onToast: (message: string) => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [sender, setSender] = useState('')
  const [queue, setQueue] = useState('')
  const [failures, setFailures] = useState<Array<{ id: number; event_key: string; email_attempts: number; email_last_error: string }>>([])
  const [preview, setPreview] = useState('')
  const [mobile, setMobile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const load = async () => {
    try {
      const response = await api.adminEmailStatus()
      setConfigured(response.data.configured)
      setSender(`${response.data.sender_name} <${response.data.sender_email}>`)
      setQueue(response.data.queue_connection)
      setFailures(response.data.recent_failures)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Email settings could not be loaded.')
    }
  }
  useEffect(() => { void load() }, [])
  const showPreview = async (event: 'welcome' | 'reserved' | 'proof_submitted' | 'proof_approved' | 'changes_requested' | 'payout_processing' | 'payout_paid' | 'payout_failed') => {
    setBusy(true)
    try {
      const response = await api.adminEmailPreview(event)
      setPreview(response.data.html)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Email preview could not be rendered.')
    } finally { setBusy(false) }
  }
  const sendTest = async () => {
    setBusy(true)
    setTestState('sending')
    try {
      await api.adminSendTestEmail()
      setTestState('success')
      onToast('Test email sent successfully.')
      void load()
    } catch (error) {
      setTestState('error')
      onToast(error instanceof Error ? error.message : 'Test email could not be sent.')
    } finally { setBusy(false) }
  }
  return <><section className="card mx-auto max-w-[1240px] p-5 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Transactional email</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Delivery and template tools</h2><p className="mt-1 text-xs leading-5 text-muted">SMTP secrets stay on the server. SMTP tests go only to your signed-in admin address; real workflow messages are delivered through the queue.</p></div><div className={`rounded-full px-3 py-1 text-xs font-semibold ${configured ? 'bg-[#ECFDF3] text-success' : 'bg-[#FEF2F2] text-error'}`}>{configured === null ? 'Checking…' : configured ? 'Configured' : 'Not configured'}</div></div>
    <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2"><div className="rounded-xl border border-line bg-canvas p-3"><span className="text-muted">Sender</span><p className="mt-1 break-all font-semibold text-ink">{sender || 'Not configured'}</p></div><div className="rounded-xl border border-line bg-canvas p-3"><span className="text-muted">Queue connection</span><p className="mt-1 font-semibold text-ink">{queue || 'Unavailable'}</p></div></div>
    <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void sendTest()} className="btn-primary disabled:opacity-60"><Send size={15} />{busy ? 'Sending SMTP test…' : 'Send SMTP Test Email'}</button>{(['welcome', 'reserved', 'proof_submitted', 'proof_approved', 'changes_requested', 'payout_processing', 'payout_paid', 'payout_failed'] as const).map((event) => <button key={event} disabled={busy} onClick={() => void showPreview(event)} className="btn-secondary capitalize disabled:opacity-60">Preview {event.replace(/_/g, ' ')}</button>)}</div>
    {preview && <div className="mt-5"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-ink">Template preview</p><button onClick={() => setMobile((value) => !value)} className="btn-secondary">{mobile ? 'Desktop width' : 'Mobile width'}</button></div><div className="overflow-auto rounded-xl border border-line bg-canvas p-3"><iframe title="Transactional email preview" srcDoc={preview} className={`mx-auto block min-h-[720px] border-0 bg-white shadow-sm ${mobile ? 'w-[375px]' : 'w-full max-w-[640px]'}`} /></div></div>}
    {failures.length > 0 && <div className="mt-5 rounded-xl border border-[#F4B7B7] bg-[#FEF2F2] p-3"><p className="text-xs font-semibold text-error">Recent delivery failures</p><ul className="mt-2 space-y-1 text-xs text-muted">{failures.map((failure) => <li key={failure.id}>{failure.event_key} · {failure.email_attempts} attempts · {failure.email_last_error}</li>)}</ul></div>}
  </section><Modal open={testState !== 'idle'} title={testState === 'success' ? 'Test email sent successfully' : testState === 'error' ? 'Test email could not be sent' : 'Sending test email…'} description={testState === 'error' ? 'Check the server mail configuration and recent delivery failures, then try again.' : 'The test is sent only to your signed-in admin email address.'} onClose={() => { if (testState !== 'sending') setTestState('idle') }} size="sm"><div className="flex justify-end"><button disabled={testState === 'sending'} onClick={() => setTestState('idle')} className="btn-primary disabled:opacity-60">Done</button></div></Modal></>
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
          <div><p className="eyebrow">Catalog preview only</p><h2 id="demo-data-heading" className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">Sample Catalog Data</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Seeds synthetic digital products only. It creates no demo users, reservations, proofs, payouts, or Airwallex activity. Real members who use a sample task receive the normal queued workflow emails.</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge tone={status?.installed ? 'success' : 'neutral'} dot>{loading ? 'Checking…' : status?.installed ? 'Installed' : 'Not seeded'}</StatusBadge>
          <button type="button" onClick={() => void loadStatus()} disabled={loading || busy} className="btn-ghost min-h-9 px-2.5 text-xs disabled:opacity-50" aria-label="Reload demo data status"><RefreshCw size={14} /></button>
        </div>
      </div>
      {loadError && <p role="alert" className="mt-4 rounded-lg border border-[#F4B7B7] bg-[#FEF2F2] px-3 py-2 text-xs text-error">{loadError}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-canvas px-3 py-3"><p className="text-[10px] font-medium text-muted">{label}</p><p className="number mt-1 text-lg font-semibold text-navy">{value ?? '—'}</p></div>)}</div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => void seed()} disabled={busy || loading} className="btn-primary min-h-10 px-3 text-xs disabled:opacity-50"><Database size={14} />{busy ? 'Working…' : 'Seed Catalog Data'}</button>
        <button type="button" onClick={() => { setIntent('refresh'); setConfirmation('') }} disabled={busy || loading} className="btn-secondary min-h-10 px-3 text-xs disabled:opacity-50"><RefreshCw size={14} />Refresh Catalog Data</button>
        <button type="button" onClick={() => { setIntent('clear'); setConfirmation('') }} disabled={busy || loading || !status?.installed} className="btn-ghost min-h-10 px-3 text-xs text-error hover:bg-[#FEF2F2] disabled:opacity-50"><Trash2 size={14} />Delete Catalog Data</button>
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
  return <header className="flex items-center justify-between py-5"><Logo onClick={() => onNavigate('landing')} /><nav className="hidden items-center gap-1 md:flex"><button onClick={() => onNavigate('how')} className="btn-ghost">How it works</button><button onClick={() => onNavigate('tasks')} className="btn-ghost">Browse tasks</button><button onClick={() => onNavigate('login')} className="btn-ghost">Sign in</button><button onClick={() => onNavigate('register')} className="btn-primary ml-2 min-h-10">Get started <ArrowRight size={15} /></button></nav><button onClick={() => onNavigate('register')} className="btn-primary min-h-10 px-3 text-xs md:hidden">Get started</button></header>
}

function LegacyLandingPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  return <div className="min-h-screen overflow-x-hidden bg-white text-ink"><div className="mx-auto max-w-[1240px] px-5 sm:px-8"><PublicHeader onNavigate={onNavigate} /><section className="grid gap-10 pb-16 pt-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-24 lg:pt-16"><div><div className="inline-flex items-center gap-2 rounded-full border border-[#C8D8EB] bg-soft-blue px-3 py-1.5 text-[11px] font-semibold text-navy"><span className="h-1.5 w-1.5 rounded-full bg-success" /> A clearer way to earn online</div><h1 className="mt-6 max-w-[620px] text-[44px] font-semibold leading-[1.04] tracking-[-0.06em] text-ink sm:text-[64px]">Turn smart purchases into <span className="text-navy">real rewards.</span></h1><p className="mt-6 max-w-[530px] text-base leading-7 text-muted sm:text-lg">Click & Earn connects you with funded purchase tasks. Review the task terms, reserve a slot, submit purchase proof, and track the review and payout status.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={() => onNavigate('register')} className="btn-primary min-h-12 px-5">Start earning <ArrowRight size={17} /></button><button onClick={() => onNavigate('how')} className="btn-secondary min-h-12 px-5">See how it works <ChevronRight size={17} /></button></div><div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-success" /> Clear reward terms</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-navy" /> Status updates from the workflow</span><span className="flex items-center gap-2"><LockKeyhole size={15} className="text-navy" /> Secure proof review</span></div></div><div className="relative"><div className="absolute -inset-6 rounded-[40px] bg-soft-blue/70 blur-2xl" /><div className="relative overflow-hidden rounded-[28px] border border-[#C8D8EB] bg-[#F4F7FB] p-3 shadow-soft sm:p-5"><div className="overflow-hidden rounded-2xl border border-line bg-white"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-navy"><span className="h-3 w-3 rounded-[4px] border border-white" /></span><span className="text-xs font-bold text-ink">Click & Earn</span></div><span className="rounded-full bg-soft-blue px-2 py-1 text-[9px] font-semibold text-navy">Task details</span></div><div className="grid gap-3 p-4 sm:grid-cols-[1fr_0.88fr]"><div><p className="text-[10px] uppercase tracking-[0.12em] text-subtle">Task economics</p><h2 className="mt-1 text-base font-semibold text-ink">Know the terms before reserving</h2><div className="mt-5 space-y-3 rounded-xl bg-canvas p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-muted">Reimbursement</span><span className="text-[10px] font-semibold text-ink">Shown on each task</span></div><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-muted">Incentive</span><span className="text-[10px] font-semibold text-ink">Shown on each task</span></div><div className="border-t border-line pt-3"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-ink">Expected payout</span><span className="text-[10px] font-semibold text-navy">Calculated from task terms</span></div></div></div><div className="mt-4 flex items-center gap-2 rounded-lg bg-soft-blue px-3 py-2.5 text-[10px] leading-4 text-navy"><ShieldCheck size={15} /> The server records these values when a slot is reserved.</div></div><div className="rounded-xl bg-navy p-3 text-white"><p className="text-[10px] font-semibold">Reward workflow</p><div className="mt-5 space-y-3">{['Reserve a task', 'Complete the purchase', 'Submit proof', 'Review and payout'].map((step, index) => <div key={step} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full border border-white/20 text-[9px] font-semibold text-white/70">{index + 1}</span><span className="text-[10px] text-white/75">{step}</span></div>)}</div><div className="mt-6 rounded-lg bg-white/10 p-2.5"><p className="text-[9px] text-white/50">Each status is tied to a real workflow event.</p></div></div></div></div></div></div></section><section className="border-t border-line py-16 sm:py-20"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="eyebrow">A marketplace with receipts</p><h2 className="mt-2 max-w-lg text-3xl font-semibold leading-tight tracking-[-0.05em] text-ink sm:text-4xl">Every reward has a clear path from purchase to payout.</h2></div><p className="max-w-xl text-sm leading-6 text-muted">No mystery balances or vague promises. Click & Earn shows you the product price, incentive, proof requirements, and payout status up front.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3"><InfoStep number="01" title="Choose a funded task" body="Browse opportunities with the purchase amount, incentive, and remaining slots clearly displayed." icon={<Tag size={19} />} /><InfoStep number="02" title="Purchase & prove" body="Complete checkout with the partner, then upload a receipt or screenshot with the key details." icon={<FileCheck2 size={19} />} /><InfoStep number="03" title="Get paid" body="After verification, your reimbursement and incentive move through processing to your payout method." icon={<CircleDollarSign size={19} />} /></div></section><section className="pb-16 sm:pb-24"><div className="flex flex-col gap-5 rounded-[28px] bg-navy p-6 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between"><div><p className="eyebrow text-white/50">Ready when you are</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Make your next smart purchase count.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-white/60">Join a growing community completing useful, funded tasks and getting rewarded for the proof.</p></div><button onClick={() => onNavigate('register')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-navy transition-[background-color,transform] duration-200 hover:bg-soft-blue active:scale-[0.96]">Create your account <ArrowRight size={16} /></button></div></section><footer className="flex flex-col gap-4 border-t border-line py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between"><Logo compact /><span>© 2026 Click & Earn. Built for clear, proof-first rewards.</span><div className="flex gap-4"><button onClick={() => onNavigate('how')} className="hover:text-navy">How it works</button><button onClick={() => onNavigate('login')} className="hover:text-navy">Sign in</button></div></footer></div></div>
}

function InfoStep({ number, title, body, icon }: { number: string; title: string; body: ReactNode; icon: ReactNode }) {
  return <div className="card p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-blue text-navy">{icon}</span><span className="text-[11px] font-bold tracking-[0.16em] text-subtle">{number}</span></div><h3 className="mt-5 text-sm font-semibold text-ink">{title}</h3><p className="mt-2 text-xs leading-5 text-muted">{body}</p></div>
}

function LegacyHowPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  return <div className="min-h-screen bg-white text-ink"><div className="mx-auto max-w-[1000px] px-5 sm:px-8"><PublicHeader onNavigate={onNavigate} /><div className="py-12 sm:py-20"><button onClick={() => onNavigate('landing')} className="btn-ghost -ml-3 mb-6"><ArrowLeft size={16} /> Back home</button><p className="eyebrow">How Click & Earn works</p><h1 className="mt-2 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.06em] sm:text-6xl">One purchase. One proof. One clear reward journey.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-muted">Click & Earn is designed around transparency. You always know what you’ll pay, what you’ll earn, and exactly where your submission is in the process.</p><div className="mt-12 space-y-4">{[{ number: '01', title: 'Choose a task that fits', body: 'Browse funded tasks by category, reward, and available slots. Every card shows the full expected payout before you commit.', icon: <Tag size={20} /> }, { number: '02', title: 'Complete the external purchase', body: 'Open the partner checkout, purchase the digital product, and keep your confirmation or receipt close by.', icon: <ExternalLink size={20} /> }, { number: '03', title: 'Submit your proof', body: 'Return to Click & Earn and upload a screenshot, receipt, or PDF. Add the amount, date, time, and transaction reference.', icon: <Upload size={20} /> }, { number: '04', title: 'Track verification to payout', body: 'Your proof moves through verification, processing, and payout. You’ll receive an update at each meaningful step.', icon: <CircleDollarSign size={20} /> }].map((step) => <div key={step.number} className="grid gap-5 rounded-2xl border border-line bg-canvas p-5 sm:grid-cols-[72px_1fr_1.3fr] sm:items-center sm:p-7"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-navy text-sm font-bold text-white">{step.number}</span><div className="flex items-center gap-3 sm:block"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-navy sm:mb-3">{step.icon}</span><h2 className="text-lg font-semibold tracking-[-0.03em] text-ink">{step.title}</h2></div><p className="text-sm leading-6 text-muted">{step.body}</p></div>)}</div><div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#C8D8EB] bg-soft-blue p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="text-sm font-semibold text-navy">Ready to explore funded tasks?</p><p className="mt-1 text-xs text-[#526D96]">Create a free account and see your first opportunities.</p></div><button onClick={() => onNavigate('register')} className="btn-primary">Get started <ArrowRight size={15} /></button></div></div></div></div>
}

function PasswordField({ label, name, autoComplete, value, onChange, required, minLength, error }: { label: string; name?: string; autoComplete: string; value?: string; onChange?: (value: string) => void; required?: boolean; minLength?: number; error?: string }) {
  const [visible, setVisible] = useState(false)
  return <label className="block text-xs font-semibold text-ink">{label}<div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><input name={name} autoComplete={autoComplete} type={visible ? 'text' : 'password'} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="form-field pl-9 pr-11" minLength={minLength} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${name || label.replace(/\s+/g, '-')}-error` : undefined} /> <button type="button" onClick={() => setVisible((current) => !current)} className="focus-ring absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-canvas hover:text-navy" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}><span className="sr-only">{visible ? 'Hide' : 'Show'} password</span>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{error && <span id={`${name || label.replace(/\s+/g, '-')}-error`} className="mt-1 block text-[11px] font-normal text-error">{error}</span>}</label>
}

function VerifyEmailPage({ email, onResend, onLogout }: { email: string; onResend: () => Promise<void>; onLogout: () => void }) {
  const [sending, setSending] = useState(false)

  const resend = async () => {
    setSending(true)
    try {
      await onResend()
    } finally {
      setSending(false)
    }
  }

  return <div className="auth-page grid min-h-[100dvh] place-items-center bg-canvas px-5 py-8 text-ink"><section className="w-full max-w-[480px] rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-soft-blue text-navy"><Mail size={22} /></span><p className="eyebrow mt-6">Email verification required</p><h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.05em] text-ink sm:text-3xl">Confirm your email to continue</h1><p className="mt-3 text-pretty text-sm leading-6 text-muted">We sent a verification link to <strong className="font-semibold text-ink">{email}</strong>. Open that link to activate your account and use Click & Earn.</p><div className="mt-6 rounded-xl border border-[#C8D8EB] bg-soft-blue p-4 text-xs leading-5 text-[#526D96]">The link expires for your security. If you cannot find it, check your spam folder or send a new verification email.</div><button onClick={() => void resend()} disabled={sending} className="btn-primary mt-6 min-h-11 w-full disabled:cursor-wait disabled:opacity-60">{sending ? 'Sending…' : 'Send a new verification email'} <RefreshCw size={16} /></button><button onClick={onLogout} className="btn-secondary mt-3 min-h-11 w-full">Sign out</button></section></div>
}

function AuthPage({ mode, onNavigate, onToast, onAuthenticated }: { mode: 'login' | 'register' | 'forgot' | 'reset'; onNavigate: (page: AppPage) => void; onToast: (message: string) => void; onAuthenticated: (user: ApiUser) => void }) {
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const resetParams = new URLSearchParams(window.location.search)
  const resetToken = resetParams.get('token') || ''
  const resetEmail = resetParams.get('email') || ''
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

    if ((isRegister || isReset) && password !== passwordConfirmation) {
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

      if (isReset) {
        if (!resetToken || !resetEmail) {
          setServerError('This password reset link is incomplete. Request a new reset link and try again.')
          return
        }
        await api.resetPassword({ token: resetToken, email: resetEmail, password, password_confirmation: passwordConfirmation })
        window.history.replaceState({ clickEarnPage: 'login' }, '', '/')
        onToast('Your password has been reset. You can now sign in.')
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
      if (!isForgot && !isReset) setToken(null)
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
  const submitLabel = submitting ? (isRegister ? 'Creating account…' : isForgot ? 'Sending…' : isReset ? 'Resetting…' : 'Signing in…') : (isRegister ? 'Create account' : isForgot ? 'Send reset link' : isReset ? 'Reset password' : 'Sign in')

  return (
    <div className="auth-page grid min-h-[100dvh] bg-white lg:h-[100dvh] lg:min-h-0 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="flex min-h-20 items-center bg-navy px-5 text-white lg:min-h-0 lg:flex-col lg:items-start lg:justify-between lg:p-7 xl:p-9"><Logo onClick={() => onNavigate('landing')} inverted size="auth" /><div className="hidden max-w-md lg:block"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#B9D7FF]"><ShieldCheck size={24} /></span><h1 className="mt-5 text-[34px] font-semibold leading-tight tracking-[-0.05em] xl:text-4xl">A more trustworthy way to earn from digital products.</h1><p className="mt-4 text-sm leading-6 text-white/60">Click & Earn makes the path from purchase to payout simple, visible, and proof-first.</p><div className="mt-6 space-y-2.5">{['Clear reward terms', 'Secure proof review', 'Payout tracking'].map((item) => <div key={item} className="flex items-center gap-2 text-sm text-white/80"><CheckCircle2 size={16} className="text-[#8BE0AD]" />{item}</div>)}</div></div><p className="hidden text-xs text-white/40 lg:block">© 2026 Click & Earn</p></div>
      <div className="flex min-h-[calc(100dvh-64px)] flex-col px-5 py-5 sm:px-8 lg:min-h-0 lg:px-12 lg:py-5 xl:px-20"><div className="flex justify-end"><button onClick={() => onNavigate('landing')} className="btn-ghost">Back to site</button></div><div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-7 lg:py-3"><p className="eyebrow">{isRegister ? 'Join Click & Earn' : isForgot || isReset ? 'Account recovery' : 'Welcome back'}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-ink sm:text-3xl">{isRegister ? 'Create your earning account' : isForgot ? 'Reset your password' : isReset ? 'Choose a new password' : 'Sign in to your workspace'}</h2><p className="mt-2 text-sm leading-6 text-muted">{isRegister ? 'Start with a free account and see what’s available.' : isForgot ? 'Enter your email and we’ll send a secure reset link.' : isReset ? 'Create a new password for your Click & Earn account.' : 'Pick up where you left off.'}</p>
        {serverError && <div role="alert" className="mt-5 rounded-xl border border-[#F4B7B7] bg-[#FEF2F2] px-4 py-3 text-xs font-medium leading-5 text-error">{serverError}</div>}
        <form onSubmit={submit} className="mt-6 space-y-3">
          {isRegister && <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">First name<input name="first_name" autoComplete="given-name" className="form-field mt-2" required aria-invalid={Boolean(errorFor('first_name', 'name'))} />{errorFor('first_name', 'name') && <span className="mt-1 block text-[11px] font-normal text-error">{errorFor('first_name', 'name')}</span>}</label><label className="text-xs font-semibold text-ink">Last name<input name="last_name" autoComplete="family-name" className="form-field mt-2" required aria-invalid={Boolean(errorFor('last_name', 'name'))} />{errorFor('last_name', 'name') && <span className="mt-1 block text-[11px] font-normal text-error">{errorFor('last_name', 'name')}</span>}</label></div>}
          {isReset && <input type="hidden" name="token" value={resetToken} />}
          <label className="block text-xs font-semibold text-ink">Email address<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><input name="email" autoComplete="email" type="email" defaultValue={isReset ? resetEmail : undefined} readOnly={isReset} className="form-field pl-9 read-only:bg-canvas read-only:text-muted" required aria-invalid={Boolean(fieldErrors.email)} /></div>{fieldErrors.email && <span className="mt-1 block text-[11px] font-normal text-error">{fieldErrors.email}</span>}</label>
          {!isForgot && <><PasswordField key={isRegister ? 'register-password' : isReset ? 'reset-password' : 'login-password'} label={isReset ? 'New password' : 'Password'} name="password" autoComplete={isRegister || isReset ? 'new-password' : 'current-password'} minLength={8} required error={fieldErrors.password} />{(isRegister || isReset) && <PasswordField key={isReset ? 'reset-confirm-password' : 'register-confirm-password'} label="Confirm password" name="password_confirmation" autoComplete="new-password" minLength={8} required error={fieldErrors.password_confirmation} />}</>}
          {mode === 'login' && <div className="flex justify-end"><button type="button" onClick={() => onNavigate('forgot')} className="text-xs font-semibold text-navy hover:text-accent">Forgot password?</button></div>}
          <button type="submit" disabled={submitting} className="btn-primary min-h-11 w-full disabled:cursor-wait disabled:opacity-60">{submitLabel} <ArrowRight size={16} /></button>
        </form>
        <div className="mt-7 border-t border-line pt-6 text-center text-xs text-muted">{isRegister ? <>Already have an account? <button onClick={() => onNavigate('login')} className="font-semibold text-navy hover:text-accent">Sign in</button></> : isForgot || isReset ? <>Remembered your password? <button onClick={() => onNavigate('login')} className="font-semibold text-navy hover:text-accent">Back to sign in</button></> : <>New to Click & Earn? <button onClick={() => onNavigate('register')} className="font-semibold text-navy hover:text-accent">Create an account</button></>}</div></div>{isRegister && <p className="mt-5 text-center text-[11px] leading-5 text-subtle">Full Terms of Use and Privacy Notice are pending approved copy. Review the current summaries: <button type="button" onClick={() => onNavigate('terms')} className="font-semibold text-navy underline underline-offset-2">Terms</button> and <button type="button" onClick={() => onNavigate('privacy')} className="font-semibold text-navy underline underline-offset-2">Privacy</button>.</p>}</div>
    </div>
  )
}



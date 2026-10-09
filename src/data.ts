export type Task = {
  id: string
  title: string
  shortDescription: string
  description: string
  category: string
  image: string
  productPrice: number
  incentive: number
  slots: number
  availableSlots?: number
  reservedSlots?: number
  completedSlots?: number
  status: string
  sponsor: string
  instructions: string[]
  requirements: string[]
  checkoutUrl?: string
}

export type ActivityItem = {
  title: string
  meta: string
  amount: string
  status: string
  tone: string
}

export type NotificationItem = {
  id: string
  title: string
  body: string
  time: string
  icon: string
  unread: boolean
  tone: string
}

export type ReferralItem = { id: number; name: string; joined: string; status: string; reward: number; rewardStatus?: string }

export type ReservationItem = {
  id: number
  task: Task
  reimbursement: number
  incentive: number
  expectedPayout: number
  status: string
  statusLabel: string
  reservedAt?: string | null
  expiresAt?: string | null
  submittedAt?: string | null
  latestProof?: {
    id: number
    version?: number
    originalFileName: string
    purchaseAmount?: number
    purchaseDate?: string
    purchaseTime?: string | null
    transactionReference?: string | null
    status: string
    downloadUrl: string
    userNote?: string | null
    verification?: {
      confidenceScore: number
      detectedAmount: number | null
      warnings: string[]
    } | null
  } | null
}

export type VerificationQueueItem = {
  id: string
  backendId?: number
  status?: string
  member: string
  task: string
  submitted: string
  amount: number
  reimbursement: number
  incentive: number
  expectedPayout: number
  confidence: string
  proof: string
  downloadUrl?: string
  purchaseDate?: string | null
  purchaseTime?: string | null
  transactionReference?: string | null
  userNote?: string | null
  detectedAmount?: number | null
  detectedDate?: string | null
  detectedTime?: string | null
  detectedReference?: string | null
  amountMatches?: boolean | null
  dateValid?: boolean | null
  referencePresent?: boolean | null
  warnings: string[]
}

export type AdminPayoutRow = {
  id: string
  backendId?: number
  member: string
  task: string
  reimbursement: number
  incentive: number
  total: number
  status: string
  reference: string
  date: string
}

export type MemberRow = { initials: string; name: string; email: string; tasks: number; earned: number; status: string }
export type AdminReferralRow = { id: number; referrer: string; referredUser: string; status: string; reward: number; rewardStatus: string; registeredAt: string }
export type AdminTransactionRow = { id: string; member: string; type: string; status: string; amount: number; createdAt: string }
export type AdminNotificationRow = { id: number; title: string; body: string; recipient: string; emailStatus: string; createdAt: string }

const money = (value: unknown) => '$' + Number(value || 0).toFixed(2)
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString() : '—'
const readableStatus = (value?: string | null) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—'
const confidenceLabel = (value?: number | null) => value === null || value === undefined
  ? 'Not checked'
  : value >= 0.85 ? 'High' : value >= 0.6 ? 'Medium' : 'Review'

export let tasks: Task[] = []
export let adminTasks: Task[] = []
export let reservations: ReservationItem[] = []
export let activity: ActivityItem[] = []
export let notifications: NotificationItem[] = []
export let payouts: Array<{ id: string; date: string; method: string; amount: number; status: string; reference: string }> = []
export let referrals: ReferralItem[] = []
export let verificationQueue: VerificationQueueItem[] = []
export let adminPayouts: AdminPayoutRow[] = []
export let members: MemberRow[] = []
export let adminReferrals: AdminReferralRow[] = []
export let adminTransactions: AdminTransactionRow[] = []
export let adminNotifications: AdminNotificationRow[] = []

export let dashboardStats = {
  pendingEarnings: '—',
  processingPayouts: '—',
  paidEarnings: '—',
  referralEarnings: '—',
  tasksInProgress: '—',
  completedTasks: '—',
  successfulReferrals: '—',
  totalReferrals: '—',
  referralCode: '',
}

export let adminStats = {
  activeTasks: '—',
  pendingVerification: '—',
  approvedPayouts: '—',
  reservedRewards: '—',
  totalPaid: '—',
  activeUsers: '—',
  reservedSlots: '—',
  processingPayouts: '—',
  referralTotals: '—',
  qualifiedReferrals: '—',
  referralConversion: '—',
  referralRewardsPaid: '—',
}

export let adminNotificationStats = {
  sentThisMonth: '—',
  pendingEmail: '—',
  failedEmail: '—',
  unreadInApp: '—',
}

type BackendTask = {
  id: number
  title: string
  short_description?: string
  description: string
  category: string
  image?: string | null
  product_price?: number
  reimbursement_amount?: number
  incentive?: number
  expected_payout?: number
  slots?: number
  available_slots?: number
  reserved_slots?: number
  completed_slots?: number
  status: string
  sponsor?: string
  instructions?: string[]
  requirements?: string[]
  checkout_url?: string | null
}

type BackendReservation = {
  id: number
  task_id: number
  task: BackendTask
  reimbursement_amount: number
  incentive_amount: number
  expected_payout: number
  status: string
  status_label: string
  reserved_at?: string | null
  expires_at?: string | null
  submitted_at?: string | null
  latest_proof?: {
    id: number
    version?: number
    original_file_name: string
    purchase_amount?: number
    purchase_date?: string
    purchase_time?: string | null
    transaction_reference?: string | null
    status: string
    user_note?: string | null
    verification?: { confidence_score: number; detected_amount: number | null; warnings: string[] } | null
  } | null
}

function mapTask(task: BackendTask): Task {
  const remaining = task.slots ?? Math.max(0, (task.available_slots ?? 0) - (task.reserved_slots ?? 0) - (task.completed_slots ?? 0))
  return {
    id: String(task.id),
    title: task.title,
    shortDescription: task.short_description || task.description,
    description: task.description,
    category: task.category,
    image: task.image || '',
    productPrice: task.product_price ?? task.reimbursement_amount ?? 0,
    incentive: task.incentive ?? 0,
    slots: remaining,
    availableSlots: task.available_slots,
    reservedSlots: task.reserved_slots,
    completedSlots: task.completed_slots,
    status: readableStatus(task.status),
    sponsor: task.sponsor || 'Click & Earn partner',
    instructions: task.instructions || [],
    requirements: task.requirements || [],
    checkoutUrl: task.checkout_url || undefined,
  }
}

export function hydrateMarketplaceData(payload: {
  tasks?: BackendTask[]
  reservations?: BackendReservation[]
  notifications?: Array<{ id: string; title: string; body: string; type?: string; read?: boolean; created_at?: string | null }>
}): void {
  if (payload.tasks !== undefined) tasks = payload.tasks.map(mapTask)
  if (payload.reservations !== undefined) {
    reservations = payload.reservations.map((reservation) => ({
      id: reservation.id,
      task: mapTask(reservation.task),
      reimbursement: reservation.reimbursement_amount,
      incentive: reservation.incentive_amount,
      expectedPayout: reservation.expected_payout,
      status: reservation.status,
      statusLabel: reservation.status_label,
      reservedAt: reservation.reserved_at,
      expiresAt: reservation.expires_at,
      submittedAt: reservation.submitted_at,
      latestProof: reservation.latest_proof ? {
        id: reservation.latest_proof.id,
        version: reservation.latest_proof.version,
        originalFileName: reservation.latest_proof.original_file_name,
        purchaseAmount: reservation.latest_proof.purchase_amount,
        purchaseDate: reservation.latest_proof.purchase_date,
        purchaseTime: reservation.latest_proof.purchase_time,
        transactionReference: reservation.latest_proof.transaction_reference,
        status: reservation.latest_proof.status,
        downloadUrl: `/proof/${reservation.latest_proof.id}/download`,
        userNote: reservation.latest_proof.user_note,
        verification: reservation.latest_proof.verification ? {
          confidenceScore: reservation.latest_proof.verification.confidence_score,
          detectedAmount: reservation.latest_proof.verification.detected_amount,
          warnings: reservation.latest_proof.verification.warnings || [],
        } : null,
      } : null,
    }))
  }
  if (payload.notifications !== undefined) {
    notifications = payload.notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      time: dateLabel(item.created_at),
      icon: item.type === 'success' ? 'check' : item.type === 'warning' ? 'bookmark' : item.type === 'info' ? 'sparkle' : 'file',
      unread: !item.read,
      tone: item.type === 'success' ? 'success' : item.type === 'warning' ? 'warning' : item.type === 'info' ? 'info' : 'processing',
    }))
  }
}

export function hydrateDashboardData(stats: Record<string, string | number>, referralCode?: string): void {
  dashboardStats = {
    ...dashboardStats,
    pendingEarnings: money(stats.pending_earnings),
    processingPayouts: money(stats.processing_payouts),
    paidEarnings: money(stats.paid_earnings),
    referralEarnings: money(stats.referral_earnings),
    tasksInProgress: String(stats.tasks_in_progress ?? 0),
    completedTasks: String(stats.completed_tasks ?? 0),
    successfulReferrals: String(stats.successful_referrals ?? 0),
    referralCode: referralCode ?? dashboardStats.referralCode,
  }
}

type AdminQueuePayload = {
  verification?: Array<{ id: number; reference: string; member?: string | null; task?: string | null; amount: number; reimbursement_amount?: number; incentive: number; expected_payout?: number; status?: string; submitted_at?: string | null; confidence?: number | null; file_name?: string | null; warnings?: string[] }>
  payouts?: Array<{ id: number; member?: string | null; task?: string | null; amount: number; reimbursement_amount?: number; incentive_amount?: number; status: string; provider_reference?: string | null; requested_at?: string | null; paid_at?: string | null }>
}

function mapQueueSubmission(item: NonNullable<AdminQueuePayload['verification']>[number]): VerificationQueueItem {
  return {
    id: item.reference,
    backendId: item.id,
    status: item.status,
    member: item.member || 'Member',
    task: item.task || 'Task',
    submitted: dateLabel(item.submitted_at),
    amount: item.amount,
    reimbursement: item.reimbursement_amount ?? item.amount,
    incentive: item.incentive,
    expectedPayout: item.expected_payout ?? (item.reimbursement_amount ?? item.amount) + item.incentive,
    confidence: confidenceLabel(item.confidence),
    proof: item.file_name || 'Proof file',
    warnings: item.warnings || [],
  }
}

export function hydrateAdminData(stats: Record<string, string | number>, queues?: AdminQueuePayload): void {
  adminStats = {
    ...adminStats,
    activeTasks: String(stats.active_tasks ?? 0),
    pendingVerification: String(stats.pending_submissions ?? 0),
    approvedPayouts: money(stats.approved_payouts),
    reservedRewards: money(stats.reserved_rewards),
    totalPaid: money(stats.paid_payouts),
    activeUsers: String(stats.active_users ?? 0),
    reservedSlots: String(stats.reserved_slots ?? 0),
    processingPayouts: money(stats.processing_payouts),
    referralTotals: String(stats.referral_totals ?? 0),
    qualifiedReferrals: String(stats.qualified_referrals ?? 0),
    referralConversion: `${Number(stats.referral_conversion_rate ?? 0).toFixed(1)}%`,
    referralRewardsPaid: money(stats.referral_rewards_paid),
  }
  if (queues !== undefined) {
    verificationQueue = (queues.verification ?? []).map(mapQueueSubmission)
    adminPayouts = (queues.payouts ?? []).map(mapAdminPayout)
  }
}

function mapAdminPayout(item: NonNullable<AdminQueuePayload['payouts']>[number]): AdminPayoutRow {
  return {
    id: 'PAY-'.concat(String(item.id).padStart(4, '0')),
    backendId: item.id,
    member: item.member || 'Member',
    task: item.task || 'Task',
    reimbursement: item.reimbursement_amount ?? item.amount,
    incentive: item.incentive_amount ?? 0,
    total: item.amount,
    status: readableStatus(item.status),
    reference: item.provider_reference || '—',
    date: dateLabel(item.paid_at || item.requested_at),
  }
}

export function hydrateAdminSubmissions(items: Array<{
  id: number; reference: string; member?: string | null; task?: string | null; purchase_amount: number;
  reimbursement_amount?: number; incentive_amount?: number; expected_payout?: number; status: string;
  submitted_at?: string | null; file_name?: string | null; download_url?: string; purchase_date?: string | null;
  purchase_time?: string | null; transaction_reference?: string | null; user_note?: string | null;
  verification?: { confidence_score?: number | null; detected_amount?: number | null; detected_date?: string | null; detected_time?: string | null; detected_reference?: string | null; amount_matches?: boolean | null; date_valid?: boolean | null; reference_present?: boolean | null; warnings?: string[] } | null
}>): void {
  verificationQueue = items.map((item) => ({
    id: item.reference,
    backendId: item.id,
    status: item.status,
    member: item.member || 'Member',
    task: item.task || 'Task',
    submitted: dateLabel(item.submitted_at),
    amount: item.purchase_amount,
    reimbursement: item.reimbursement_amount ?? item.purchase_amount,
    incentive: item.incentive_amount ?? 0,
    expectedPayout: item.expected_payout ?? (item.reimbursement_amount ?? item.purchase_amount) + (item.incentive_amount ?? 0),
    confidence: confidenceLabel(item.verification?.confidence_score),
    proof: item.file_name || 'Proof file',
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
  }))
}

export function hydrateAdminTasks(items: BackendTask[]): void {
  adminTasks = items.map(mapTask)
}

export function hydrateAdminPayouts(items: Array<{ id: number; amount: number; reimbursement_amount?: number; incentive_amount?: number; status: string; provider_reference?: string | null; member?: string | null; task?: string | null; requested_at?: string | null; paid_at?: string | null }>): void {
  adminPayouts = items.map((item) => mapAdminPayout({
    id: item.id,
    amount: item.amount,
    reimbursement_amount: item.reimbursement_amount,
    incentive_amount: item.incentive_amount,
    status: item.status,
    provider_reference: item.provider_reference,
    member: item.member,
    task: item.task,
    requested_at: item.requested_at,
    paid_at: item.paid_at,
  }))
}

export function hydrateFinanceData(payload: {
  earnings?: { items: Array<{ id: number; amount: number; type: string; direction: string; status: string; task?: string | null; created_at?: string | null }> }
  payouts?: { items: Array<{ id: number; amount: number; currency: string; status: string; provider?: string; provider_reference?: string | null; paid_at?: string | null; requested_at?: string | null }> }
  referrals?: { code: string; qualified_count?: number; items: Array<{ id: number; name?: string | null; joined_at?: string | null; status: string; reward: number; reward_status?: string }> }
}): void {
  if (payload.earnings !== undefined) {
    activity = payload.earnings.items.map((item) => ({
      title: item.task || readableStatus(item.type),
      meta: `${readableStatus(item.status)}${item.created_at ? ' · ' + dateLabel(item.created_at) : ''}`,
      amount: `${item.direction === 'credit' ? '+' : '−'}$${Number(item.amount).toFixed(2)}`,
      status: readableStatus(item.status),
      tone: item.status === 'paid' ? 'success' : item.status === 'processing' ? 'processing' : item.status === 'failed' ? 'error' : 'warning',
    }))
  }
  if (payload.payouts !== undefined) {
    payouts = payload.payouts.items.map((item) => ({
      id: 'PO-'.concat(String(item.id).padStart(4, '0')),
      date: dateLabel(item.paid_at || item.requested_at),
      method: readableStatus(item.provider),
      amount: item.amount,
      status: readableStatus(item.status),
      reference: item.provider_reference || '—',
    }))
  }
  if (payload.referrals !== undefined) {
    referrals = payload.referrals.items.map((item) => ({
      id: item.id,
      name: item.name || 'Member',
      joined: dateLabel(item.joined_at),
      status: item.status,
      reward: item.reward,
      rewardStatus: item.reward_status,
    }))
    dashboardStats = {
      ...dashboardStats,
      referralCode: payload.referrals.code || '',
      totalReferrals: String(payload.referrals.items.length),
      successfulReferrals: String(payload.referrals.qualified_count ?? payload.referrals.items.filter((item) => item.status === 'Successful').length),
    }
  }
}

export function hydrateAdminMembers(items: Array<{ name: string; email: string; tasks_completed: number; earned: number; account_status: string }>): void {
  members = items.map((item) => ({
    initials: item.name.split(/\s+/).map((part) => part[0] || '').slice(0, 2).join('').toUpperCase(),
    name: item.name,
    email: item.email,
    tasks: item.tasks_completed,
    earned: item.earned,
    status: readableStatus(item.account_status),
  }))
}

export function hydrateAdminReferrals(items: Array<{ id: number; referrer?: string | null; referred_user?: string | null; status: string; reward: number; reward_status: string; registered_at?: string | null }>): void {
  adminReferrals = items.map((item) => ({
    id: item.id,
    referrer: item.referrer || 'Member',
    referredUser: item.referred_user || 'Member',
    status: item.status,
    reward: item.reward,
    rewardStatus: readableStatus(item.reward_status),
    registeredAt: dateLabel(item.registered_at),
  }))
}

export function hydrateAdminTransactions(items: Array<{ id: number; member?: string | null; type: string; status: string; amount: number; created_at?: string | null }>): void {
  adminTransactions = items.map((item) => ({
    id: 'TX-'.concat(String(item.id).padStart(5, '0')),
    member: item.member || 'Member',
    type: readableStatus(item.type),
    status: readableStatus(item.status),
    amount: item.amount,
    createdAt: dateLabel(item.created_at),
  }))
}

export function hydrateAdminNotifications(items: Array<{ id: number; title: string; body: string; recipient?: string | null; email_status: string; created_at?: string | null }>, summary?: { sent_this_month: number; pending_email: number; failed_email: number; unread_in_app: number }): void {
  adminNotifications = items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    recipient: item.recipient || 'Member',
    emailStatus: readableStatus(item.email_status),
    createdAt: dateLabel(item.created_at),
  }))
  if (summary) {
    adminNotificationStats = {
      sentThisMonth: String(summary.sent_this_month),
      pendingEmail: String(summary.pending_email),
      failedEmail: String(summary.failed_email),
      unreadInApp: String(summary.unread_in_app),
    }
  }
}

export function markNotificationsRead(): void {
  notifications = notifications.map((notification) => ({ ...notification, unread: false }))
}

export function clearAllData(): void {
  tasks = []
  adminTasks = []
  reservations = []
  activity = []
  notifications = []
  payouts = []
  referrals = []
  verificationQueue = []
  adminPayouts = []
  members = []
  adminReferrals = []
  adminTransactions = []
  adminNotifications = []
  dashboardStats = {
    pendingEarnings: '—',
    processingPayouts: '—',
    paidEarnings: '—',
    referralEarnings: '—',
    tasksInProgress: '—',
    completedTasks: '—',
    successfulReferrals: '—',
    totalReferrals: '—',
    referralCode: '',
  }
  adminStats = {
    activeTasks: '—',
    pendingVerification: '—',
    approvedPayouts: '—',
    reservedRewards: '—',
    totalPaid: '—',
    activeUsers: '—',
    reservedSlots: '—',
    processingPayouts: '—',
    referralTotals: '—',
    qualifiedReferrals: '—',
    referralConversion: '—',
    referralRewardsPaid: '—',
  }
  adminNotificationStats = {
    sentThisMonth: '—',
    pendingEmail: '—',
    failedEmail: '—',
    unreadInApp: '—',
  }
}

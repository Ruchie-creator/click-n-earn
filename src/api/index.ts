import { apiDownload, apiFetch, apiUpload, getToken, setToken } from './client'
import type { AdminDashboardData, ApiDemoClearResult, ApiDemoStatus, ApiEnvelope, ApiPayout, ApiPayoutMethod, ApiReservation, ApiTask, ApiUser, DashboardData, EarningsData, NotificationData, PayoutListData, ReferralListData, TaskListData } from './contracts'

export { apiDownload, apiFetch, apiUpload, getToken, setToken }
export type { ApiError } from './client'
export type * from './contracts'

export const api = {
  me() {
    return apiFetch<ApiEnvelope<ApiUser>>('/me')
  },
  async login(email: string, password: string) {
    const response = await apiFetch<ApiEnvelope<{ user: ApiUser; token: string }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, device_name: 'click-and-earn-web' }),
    })
    setToken(response.data.token)
    return response.data
  },
  async register(name: string, email: string, password: string, passwordConfirmation = password, referralCode?: string) {
    const response = await apiFetch<ApiEnvelope<{ user: ApiUser; token: string }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, password_confirmation: passwordConfirmation, referral_code: referralCode }),
    })
    setToken(response.data.token)
    return response.data
  },
  forgotPassword(email: string) {
    return apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
  },
  logout() {
    return apiFetch('/logout', { method: 'POST' }).finally(() => setToken(null))
  },
  dashboard() {
    return apiFetch<ApiEnvelope<DashboardData>>('/dashboard')
  },
  tasks(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString()
    return apiFetch<ApiEnvelope<TaskListData>>('/tasks' + (query ? '?' + query : ''))
  },
  reservations() {
    return apiFetch<ApiEnvelope<{ items: ApiReservation[] }>>('/reservations')
  },
  reserveTask(taskId: string | number) {
    return apiFetch<ApiEnvelope<ApiReservation>>('/tasks/' + taskId + '/reserve', { method: 'POST' })
  },
  submitProof(reservationId: string | number, fields: { file: File; purchaseAmount: string; purchaseDate: string; purchaseTime?: string; reference: string; note?: string; idempotencyKey: string }) {
    const body = new FormData()
    body.append('proof', fields.file)
    body.append('purchase_amount', fields.purchaseAmount)
    body.append('purchase_date', fields.purchaseDate)
    if (fields.purchaseTime) body.append('purchase_time', fields.purchaseTime)
    body.append('transaction_reference', fields.reference)
    if (fields.note) body.append('user_note', fields.note)
    return apiFetch<ApiEnvelope<{ id: number; status: string }>>('/reservations/' + reservationId + '/proof', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': fields.idempotencyKey },
    })
  },
  earnings() {
    return apiFetch<ApiEnvelope<EarningsData>>('/earnings')
  },
  referrals() {
    return apiFetch<ApiEnvelope<ReferralListData>>('/referrals')
  },
  payouts() {
    return apiFetch<ApiEnvelope<PayoutListData>>('/payouts')
  },
  payoutMethods() {
    return apiFetch<ApiEnvelope<ApiPayoutMethod[]>>('/payout-methods')
  },
  savePayoutMethod(payload: Record<string, unknown>) {
    return apiFetch<ApiEnvelope<ApiPayoutMethod>>('/payout-methods', { method: 'POST', body: JSON.stringify(payload) })
  },
  updatePayoutMethod(id: string | number, payload: Record<string, unknown>) {
    return apiFetch<ApiEnvelope<ApiPayoutMethod>>('/payout-methods/' + id, { method: 'PUT', body: JSON.stringify(payload) })
  },
  updateProfile(payload: { name?: string; phone?: string; country?: string }) {
    return apiFetch<ApiEnvelope<ApiUser>>('/me', { method: 'PUT', body: JSON.stringify(payload) })
  },
  updateProfilePhoto(file: File, onProgress?: (progress: number) => void) {
    const body = new FormData()
    body.append('avatar', file)
    return apiUpload<ApiEnvelope<ApiUser>>('/profile/photo', body, onProgress)
  },
  changePassword(payload: { current_password: string; password: string; password_confirmation: string }) {
    return apiFetch('/password', { method: 'POST', body: JSON.stringify(payload) })
  },
  notifications() {
    return apiFetch<ApiEnvelope<NotificationData>>('/notifications')
  },
  markNotificationRead(id: string) {
    return apiFetch('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' })
  },
  markAllNotificationsRead() {
    return apiFetch('/notifications/read-all', { method: 'POST' })
  },
  adminDashboard() {
    return apiFetch<ApiEnvelope<AdminDashboardData>>('/admin/dashboard')
  },
  adminTasks() {
    return apiFetch<ApiEnvelope<ApiTask[]>>('/admin/tasks')
  },
  adminCreateTask(payload: Record<string, unknown>) {
    return apiFetch<ApiEnvelope<ApiTask>>('/admin/tasks', { method: 'POST', body: JSON.stringify(payload) })
  },
  adminUpdateTask(id: string | number, payload: Record<string, unknown>) {
    return apiFetch<ApiEnvelope<ApiTask>>('/admin/tasks/' + id, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  adminChangeTaskStatus(id: string | number, status: string) {
    return apiFetch<ApiEnvelope<ApiTask>>('/admin/tasks/' + id + '/status', { method: 'POST', body: JSON.stringify({ status }) })
  },
  adminSettings() {
    return apiFetch<ApiEnvelope<Array<{ key: string; value: Record<string, unknown> }>> >('/admin/settings')
  },
  adminDemoStatus() {
    return apiFetch<ApiEnvelope<ApiDemoStatus>>('/admin/demo-data')
  },
  adminSeedDemo() {
    return apiFetch<ApiEnvelope<ApiDemoStatus>>('/admin/demo-data/seed', { method: 'POST' })
  },
  adminRefreshDemo(confirmation: string) {
    return apiFetch<ApiEnvelope<ApiDemoStatus>>('/admin/demo-data/refresh', { method: 'POST', body: JSON.stringify({ confirmation }) })
  },
  adminClearDemo(confirmation: string) {
    return apiFetch<ApiEnvelope<ApiDemoClearResult>>('/admin/demo-data/clear', { method: 'POST', body: JSON.stringify({ confirmation }) })
  },
  adminUpdateSetting(key: string, value: Record<string, unknown>) {
    return apiFetch<ApiEnvelope<{ key: string; value: Record<string, unknown> }>>('/admin/settings/' + encodeURIComponent(key), { method: 'PATCH', body: JSON.stringify({ value }) })
  },
  adminSubmissions() {
    return apiFetch<ApiEnvelope<{ items: ApiAdminSubmission[]; meta: { current_page: number; last_page: number; total: number } }>>('/admin/submissions')
  },
  adminSubmission(id: string | number) {
    return apiFetch<ApiEnvelope<ApiAdminSubmission>>('/admin/submissions/' + id)
  },
  downloadAdminSubmission(id: string | number) {
    return apiDownload('/admin/submissions/' + id + '/download')
  },
  adminPayouts() {
    return apiFetch<ApiEnvelope<{ items: ApiAdminPayout[]; meta: { current_page: number; last_page: number; total: number } }>>('/admin/payouts')
  },
  adminUsers() {
    return apiFetch<ApiEnvelope<{ items: ApiAdminUser[]; meta: { current_page: number; last_page: number; total: number } }>>('/admin/users')
  },
  adminReferrals() {
    return apiFetch<ApiEnvelope<{ items: ApiAdminReferral[]; summary: { total: number; qualified: number; rewards_paid: number }; meta: { current_page: number; last_page: number; total: number } }>>('/admin/referrals')
  },
  adminTransactions() {
    return apiFetch<ApiEnvelope<{ items: ApiAdminTransaction[]; meta: { current_page: number; last_page: number; total: number } }>>('/admin/transactions')
  },
  adminNotifications() {
    return apiFetch<ApiEnvelope<{ items: ApiAdminNotification[]; summary: { sent_this_month: number; pending_email: number; failed_email: number; unread_in_app: number }; meta: { current_page: number; last_page: number; total: number } }>>('/admin/notifications')
  },
  reviewSubmission(id: string | number) {
    return apiFetch('/admin/submissions/' + id + '/review', { method: 'POST' })
  },
  approveSubmission(id: string | number) {
    return apiFetch('/admin/submissions/' + id + '/approve', { method: 'POST' })
  },
  requestSubmissionChanges(id: string | number, reason: string) {
    return apiFetch('/admin/submissions/' + id + '/request-changes', { method: 'POST', body: JSON.stringify({ reason }) })
  },
  rejectSubmission(id: string | number, reason: string) {
    return apiFetch('/admin/submissions/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
  },
  processPayout(id: string | number) {
    return apiFetch<ApiEnvelope<ApiPayout>>('/admin/payouts/' + id + '/process', { method: 'POST' })
  },
  retryPayout(id: string | number) {
    return apiFetch('/admin/payouts/' + id + '/retry', { method: 'POST' })
  },
  syncPayout(id: string | number) {
    return apiFetch<ApiEnvelope<ApiPayout>>('/admin/payouts/' + id + '/sync', { method: 'POST' })
  },
  markPayoutPaid(id: string | number, reference: string, note?: string) {
    return apiFetch<ApiEnvelope<ApiPayout>>('/admin/payouts/' + id + '/manual-paid', { method: 'POST', body: JSON.stringify({ reference, note }) })
  },
}

export type ApiAdminSubmission = {
  id: number
  reference: string
  member?: string | null
  email?: string | null
  task?: string | null
  reservation_id: number
  purchase_amount: number
  reimbursement_amount: number
  incentive_amount: number
  expected_payout: number
  purchase_date?: string | null
  purchase_time?: string | null
  transaction_reference?: string | null
  status: string
  file_name?: string | null
  download_url?: string
  submitted_at?: string | null
  user_note?: string | null
  verification?: {
    confidence_score?: number | null
    detected_amount?: number | null
    detected_date?: string | null
    detected_time?: string | null
    detected_reference?: string | null
    amount_matches?: boolean | null
    date_valid?: boolean | null
    reference_present?: boolean | null
    warnings?: string[]
  } | null
}

export type ApiAdminPayout = ApiPayout & { member?: string | null; email?: string | null; task?: string | null; masked_account?: string | null }
export type ApiAdminUser = ApiUser & { tasks_completed: number; earned: number }
export type ApiAdminReferral = { id: number; referrer?: string | null; referred_user?: string | null; status: string; reward: number; reward_status: string; registered_at?: string | null }
export type ApiAdminTransaction = { id: number; member?: string | null; type: string; status: string; amount: number; created_at?: string | null }
export type ApiAdminNotification = { id: number; title: string; body: string; recipient?: string | null; email_status: string; email_attempts: number; email_last_error?: string | null; created_at?: string | null }

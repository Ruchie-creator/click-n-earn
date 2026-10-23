import { apiDownload, apiFetch, apiUpload, getToken, reportClientError, setToken } from './client'
import type { AdminDashboardData, ApiAdminTaskDetail, ApiBeneficiaryCountries, ApiBeneficiarySchema, ApiDemoClearResult, ApiDemoStatus, ApiEnvelope, ApiFaq, ApiPayout, ApiPayoutMethod, ApiPayoutVerification, ApiReservation, ApiTask, ApiTaskCategory, ApiUser, DashboardData, EarningsData, NotificationData, PayoutListData, PublicTask, PublicTaskListData, ReferralListData, TaskListData } from './contracts'

export { apiDownload, apiFetch, apiUpload, getToken, reportClientError, setToken }
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
  resetPassword(payload: { token: string; email: string; password: string; password_confirmation: string }) {
    return apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) })
  },
  resendEmailVerification() {
    return apiFetch('/email/verify', { method: 'POST' })
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
  publicTasks(params: Record<string, string> = {}, options: RequestInit = {}) {
    const query = new URLSearchParams(params).toString()
    return apiFetch<ApiEnvelope<PublicTaskListData>>('/public/tasks' + (query ? '?' + query : ''), options)
  },
  publicTask(slug: string, options: RequestInit = {}) {
    return apiFetch<ApiEnvelope<PublicTask>>('/public/tasks/' + encodeURIComponent(slug), options)
  },
  publicFaqs(options: RequestInit = {}) {
    return apiFetch<ApiEnvelope<ApiFaq[]>>('/public/faqs', options)
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
  payoutMethodCountries() {
    return apiFetch<ApiEnvelope<ApiBeneficiaryCountries>>('/payout-methods/countries')
  },
  payoutMethodSchema(criteria: { country: string; currency: string; entity_type: 'PERSONAL' | 'COMPANY'; transfer_method: 'LOCAL' | 'SWIFT'; local_clearing_system?: string }) {
    const query = new URLSearchParams(Object.entries(criteria).filter(([, value]) => Boolean(value)) as Array<[string, string]>).toString()
    return apiFetch<ApiEnvelope<ApiBeneficiarySchema>>('/payout-methods/schema?' + query)
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
  adminTask(id: string | number) {
    return apiFetch<ApiEnvelope<ApiAdminTaskDetail>>('/admin/tasks/' + id)
  },
  adminTaskCategories() {
    return apiFetch<ApiEnvelope<ApiTaskCategory[]>>('/admin/task-categories')
  },
  adminCreateTaskCategory(name: string) {
    return apiFetch<ApiEnvelope<ApiTaskCategory>>('/admin/task-categories', { method: 'POST', body: JSON.stringify({ name }) })
  },
  adminUpdateTaskCategory(id: number, payload: { name?: string; is_active?: boolean; archived?: boolean }) {
    return apiFetch<ApiEnvelope<ApiTaskCategory>>('/admin/task-categories/' + id, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  adminDeleteTaskCategory(id: number) {
    return apiFetch<ApiEnvelope<{ archived: boolean; task_count: number }>>('/admin/task-categories/' + id, { method: 'DELETE' })
  },
  adminFaqs(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString()
    return apiFetch<ApiEnvelope<ApiFaq[]>>('/admin/faqs' + (query ? '?' + query : ''))
  },
  adminCreateFaq(payload: Partial<ApiFaq>) {
    return apiFetch<ApiEnvelope<ApiFaq>>('/admin/faqs', { method: 'POST', body: JSON.stringify(payload) })
  },
  adminUpdateFaq(id: number, payload: Partial<ApiFaq>) {
    return apiFetch<ApiEnvelope<ApiFaq>>('/admin/faqs/' + id, { method: 'PUT', body: JSON.stringify(payload) })
  },
  adminDeleteFaq(id: number) {
    return apiFetch<ApiEnvelope<{ deleted: boolean }>>('/admin/faqs/' + id, { method: 'DELETE' })
  },
  adminCreateTask(payload: Record<string, unknown>) {
    return apiFetch<ApiEnvelope<ApiTask>>('/admin/tasks', { method: 'POST', body: JSON.stringify(payload) })
  },
  adminUpdateTask(id: string | number, payload: Record<string, unknown>) {
    return apiFetch<ApiEnvelope<ApiTask>>('/admin/tasks/' + id, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  adminDeleteTask(id: string | number) {
    return apiFetch<ApiEnvelope<{ deleted: boolean }>>('/admin/tasks/' + id, { method: 'DELETE' })
  },
  adminForceDeleteTask(id: string | number, confirmation: string) {
    return apiFetch<ApiEnvelope<{ deleted: boolean }>>('/admin/tasks/' + id + '/force-delete', { method: 'POST', body: JSON.stringify({ confirmation }) })
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
  adminEmailStatus() {
    return apiFetch<ApiEnvelope<{ configured: boolean; sender_email: string; sender_name: string; queue_connection: string; recent_failures: Array<{ id: number; event_key: string; email_attempts: number; email_last_error: string; updated_at: string }>; events: string[] }>>('/admin/email/status')
  },
  adminAirwallexStatus() {
    return apiFetch<ApiEnvelope<{ active_environment: 'sandbox' | 'live'; sandbox: AirwallexEnvironmentStatus; live: AirwallexEnvironmentStatus; readiness: { ready: boolean; checks: Record<string, boolean>; failed_checks: string[] } }>>('/admin/airwallex/status')
  },
  adminTestAirwallexConnection(environment: 'sandbox' | 'live') {
    return apiFetch<ApiEnvelope<{ status: string }>>('/admin/airwallex/test-connection', { method: 'POST', body: JSON.stringify({ environment }) })
  },
  adminSetAirwallexEnvironment(environment: 'sandbox' | 'live', confirmation?: string) {
    return apiFetch<ApiEnvelope<{ active_environment: 'sandbox' | 'live' }>>('/admin/airwallex/environment', { method: 'POST', body: JSON.stringify({ environment, confirmation }) })
  },
  adminEmailPreview(event: 'welcome' | 'reserved' | 'proof_submitted' | 'proof_approved' | 'changes_requested' | 'payout_processing' | 'payout_paid' | 'payout_failed') {
    return apiFetch<ApiEnvelope<{ html: string }>>('/admin/email/preview', { method: 'POST', body: JSON.stringify({ event }) })
  },
  adminSendTestEmail() {
    return apiFetch('/admin/email/test', { method: 'POST' })
  },
  adminSubmissions(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString()
    return apiFetch<ApiEnvelope<{ items: ApiAdminSubmission[]; meta: { current_page: number; last_page: number; total: number } }>>('/admin/submissions' + (query ? '?' + query : ''))
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
  downloadAdminUsersExport() {
    return apiDownload('/admin/users/export')
  },
  adminUpdateUser(id: number, payload: { account_status?: string; role?: 'member' | 'admin' | 'super_admin' }) {
    return apiFetch<ApiEnvelope<ApiAdminUser>>('/admin/users/' + id, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  adminReferrals(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString()
    return apiFetch<ApiEnvelope<{ items: ApiAdminReferral[]; summary: Record<string, number>; meta: { current_page: number; last_page: number; total: number } }>>('/admin/referrals' + (query ? '?' + query : ''))
  },
  adminReferral(id: number) {
    return apiFetch<ApiEnvelope<ApiAdminReferral & { qualifying_purchase?: { reservation_id: number; task?: string | null; purchase_amount: number; approved_at?: string | null }; payout?: { id: number; status: string; amount: number; currency: string; provider_reference?: string | null; manual_reference?: string | null; masked_account?: string | null; requested_at?: string | null; paid_at?: string | null } | null; history?: Array<{ id: number; action: string; actor?: string | null; created_at?: string | null }> }>>('/admin/referrals/' + id)
  },
  adminApproveReferral(id: number, note?: string) {
    return apiFetch<ApiEnvelope<{ referral: ApiAdminReferral; payout_id: number }>>('/admin/referrals/' + id + '/approve', { method: 'POST', body: JSON.stringify({ note }) })
  },
  adminHoldReferral(id: number, reason: string) {
    return apiFetch<ApiEnvelope<ApiAdminReferral>>('/admin/referrals/' + id + '/hold', { method: 'POST', body: JSON.stringify({ reason }) })
  },
  adminResolveReferralReview(id: number, reason: string) {
    return apiFetch<ApiEnvelope<ApiAdminReferral>>('/admin/referrals/' + id + '/resolve-review', { method: 'POST', body: JSON.stringify({ reason }) })
  },
  adminPayoutVerifications(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString()
    return apiFetch<ApiEnvelope<{ items: ApiPayoutVerification[]; summary: Record<string, number>; meta: { current_page: number; last_page: number; total: number } }>>('/admin/payout-verifications' + (query ? '?' + query : ''))
  },
  adminPayoutVerification(id: number) {
    return apiFetch<ApiEnvelope<ApiPayoutVerification>>('/admin/payout-verifications/' + id)
  },
  approvePayoutVerification(id: number) {
    return apiFetch<ApiEnvelope<ApiPayoutVerification>>('/admin/payout-verifications/' + id + '/approve', { method: 'POST' })
  },
  rejectPayoutVerification(id: number, reason: string) {
    return apiFetch<ApiEnvelope<ApiPayoutVerification>>('/admin/payout-verifications/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
  },
  requestPayoutVerificationChanges(id: number, reason: string) {
    return apiFetch<ApiEnvelope<ApiPayoutVerification>>('/admin/payout-verifications/' + id + '/request-changes', { method: 'POST', body: JSON.stringify({ reason }) })
  },
  resolveDuplicatePayoutVerification(id: number, reason: string) {
    return apiFetch<ApiEnvelope<{ resolved_method_ids: number[]; count: number }>>('/admin/payout-verifications/' + id + '/resolve-duplicate', { method: 'POST', body: JSON.stringify({ reason }) })
  },
  adminTransactions() {
    return apiFetch<ApiEnvelope<{ items: ApiAdminTransaction[]; meta: { current_page: number; last_page: number; total: number } }>>('/admin/transactions')
  },
  downloadAdminTransactionInvoice(id: string | number) {
    return apiDownload('/admin/transactions/' + id + '/invoice')
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
  processPayout(id: string | number, confirmation?: string) {
    return apiFetch<ApiEnvelope<ApiPayout>>('/admin/payouts/' + id + '/process', { method: 'POST', body: JSON.stringify({ confirmation }) })
  },
  retryPayout(id: string | number) {
    return apiFetch('/admin/payouts/' + id + '/retry', { method: 'POST' })
  },
  syncPayout(id: string | number) {
    return apiFetch<ApiEnvelope<ApiPayout>>('/admin/payouts/' + id + '/sync', { method: 'POST' })
  },
  adminMarkPayoutPaid(id: number, reference: string, note: string) {
    return apiFetch<ApiEnvelope<ApiPayout>>('/admin/payouts/' + id + '/mark-paid', { method: 'POST', body: JSON.stringify({ reference, note }) })
  },
}

export type AirwallexEnvironmentStatus = { configured: boolean; credentials_configured: boolean; webhook_configured: boolean; connection: string; base_url: string }

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
export type ApiAdminReferral = {
  id: number; referrer?: string | null; referrer_email?: string | null; referred_user?: string | null; referred_email?: string | null;
  status: string; qualification_status?: string; reward: number; reward_status: string; reward_hold_reason?: string | null;
  registered_at?: string | null; qualified_at?: string | null; paid_at?: string | null; qualifying_reservation_id?: number | null;
  qualifying_task?: string | null; possible_duplicate_account?: boolean; review_unresolved?: boolean; review_note?: string | null;
  decided_by?: string | null; payout_id?: number | null; payout_status?: string | null; payout_reference?: string | null;
}
export type ApiAdminTransaction = { id: number; member?: string | null; type: string; status: string; amount: number; created_at?: string | null }
export type ApiAdminNotification = { id: number; title: string; body: string; recipient?: string | null; email_status: string; email_attempts: number; email_last_error?: string | null; created_at?: string | null }

/**
 * ONE PLACE TO WIRE THE LANDING PAGE INTO YOUR APP.
 * Change the values below to match your real routes / API. Nothing else needs editing.
 */
export const LANDING_CONFIG = {
  brandName: 'Click & Earn',
  logoSrc: '/brand/logo-wordmark.png',

  // Public routes provided by the Click & Earn history router.
  routes: {
    login: '/login',
    register: '/register',
    tasks: '/tasks',
  },

  currency: 'USD',
  maxPreviewTasks: 6,
  /** Where a task card's button goes. Receives the normalised task. */
  taskHref: (task: { id: string | number; slug?: string }) => `/tasks/${encodeURIComponent(task.slug || String(task.id))}`,

  // Only rendered when truthy. Remove / set to null for anything that doesn't exist yet.
  referralsEnabled: false,
  legal: { terms: '/terms' as string | null, privacy: '/privacy' as string | null },
  supportEmail: null as string | null,

  // SEO
  seo: {
    title: 'Earn money completing verified online tasks | Click & Earn',
    description:
      'Browse available tasks, see the reimbursement and incentive up front, submit proof, and get paid to your bank after approval. No guaranteed income — just clear task rewards.',
    siteUrl: '',
    ogImage: '', // optional absolute or root-relative image
  },
} as const;

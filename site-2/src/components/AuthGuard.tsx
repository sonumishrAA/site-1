'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseBrowser as supabase } from '@/lib/supabase/client'
import Cookies from 'js-cookie'
import { callEdgeFunction } from '@/lib/api'
import { AlertTriangle, Shield, Loader2, CheckCircle2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

declare global { interface Window { Razorpay: any } }

// ─── Hard Block Renewal Overlay ─────────────────────────────────────────────
function RenewalWall({ library, userId, onSuccess }: {
  library: { id: string; name: string; subscription_end: string; delete_date: string }
  userId: string
  onSuccess: () => void
}) {
  const [plans, setPlans] = useState<{ plan: string; amount: number; duration_minutes: number }[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>('3m')
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(true)

  const PLAN_LABELS: Record<string, string> = {
    '1m': '1 Month', '3m': '3 Months', '6m': '6 Months', '12m': '12 Months'
  }

  useEffect(() => {
    // Load Razorpay JS
    if (!document.querySelector('script[src*="razorpay"]')) {
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      document.head.appendChild(s)
    }
    // Fetch real prices from admin's pricing_config (public endpoint — no auth needed)
    callEdgeFunction('update-pricing', { method: 'GET', useAuthToken: false })
      .then((data) => {
        if (Array.isArray(data)) setPlans(data)
        else if (data.plans) setPlans(data.plans)
      })
      .catch(() => {
        // Fallback prices if fetch fails
        setPlans([
          { plan: '1m', amount: 500, duration_minutes: 43200 },
          { plan: '3m', amount: 1200, duration_minutes: 129600 },
          { plan: '6m', amount: 2200, duration_minutes: 259200 },
          { plan: '12m', amount: 4000, duration_minutes: 525600 },
        ])
      })
      .finally(() => setLoadingPlans(false))
  }, [])

  const selectedPlanData = plans.find(p => p.plan === selectedPlan)

  const handlePay = async () => {
    if (!selectedPlanData) return
    setPaying(true)
    try {
      // Generate auth token
      const { token } = await callEdgeFunction('generate-token', {
        body: { library_id: library.id, purpose: 'renew' },
        useAuthToken: true,
      })
      // Create renewal order
      const planMonths = selectedPlan === '1m' ? 1 : selectedPlan === '3m' ? 3 : selectedPlan === '6m' ? 6 : 12
      const { order_id, amount, key } = await callEdgeFunction('create-renewal-order', {
        body: { token, library_id: library.id, plan_months: planMonths },
      })
      const options = {
        key, amount, currency: 'INR',
        name: 'LibraryOS',
        description: `${PLAN_LABELS[selectedPlan]} Renewal — ${library.name}`,
        order_id,
        handler: async (response: any) => {
          try {
            const data = await callEdgeFunction('verify-renewal', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                library_id: library.id,
                plan_months: planMonths,
              },
            })
            if (data.success) {
              setSuccess(true)
              setTimeout(() => onSuccess(), 2000)
            }
          } catch (err) { console.error('Verify failed', err) }
        },
        prefill: { name: library.name },
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setPaying(false) },
      }
      new window.Razorpay(options).open()
    } catch (e) {
      console.error(e)
      setPaying(false)
    }
  }

  const today = new Date()
  const subEnd = new Date(library.subscription_end)
  const minutesPast = Math.ceil((today.getTime() - subEnd.getTime()) / 60000)
  const deleteDate = new Date(library.delete_date)
  const daysUntilDelete = Math.ceil((deleteDate.getTime() - today.getTime()) / 86400000)

  return (
    // Full-screen overlay — z-[9999] so nothing can appear above it
    <div
      className="fixed inset-0 z-[9999] bg-[#0F1F5C] flex flex-col items-center justify-center p-4 overflow-y-auto"
      // Capture all pointer events — nothing behind can be clicked
      style={{ touchAction: 'none' }}
    >
      <div className="w-full max-w-sm py-8">

        {success ? (
          <div className="text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Renewed Successfully!</h2>
            <p className="text-white/60 mt-2 text-sm">Loading your dashboard…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Subscription Expired</h1>
              <p className="text-white/50 text-sm mt-1">{library.name}</p>
              <p className="text-white/30 text-xs mt-0.5">
                Expired {minutesPast < 60
                  ? `${minutesPast} min ago`
                  : minutesPast < 1440
                  ? `${Math.floor(minutesPast / 60)}h ago`
                  : `${Math.floor(minutesPast / 1440)} days ago`}
              </p>
            </div>

            {/* Info card */}
            <div className="bg-white/5 rounded-2xl p-4 mb-5 space-y-2.5 border border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-white/50 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Data safe until
                </span>
                <span className={cn('font-bold text-sm', daysUntilDelete > 5 ? 'text-green-400' : 'text-red-400')}>
                  {daysUntilDelete > 0 ? `${daysUntilDelete} days` : '⚠ Deleting soon'}
                </span>
              </div>
              <p className="text-white/40 text-[11px] pt-2 border-t border-white/5">
                All student data is safe. Renew now to restore full access immediately.
              </p>
            </div>

            {/* Plan selector */}
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Choose Plan</p>
            {loadingPlans ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-5">
                {plans.map(plan => (
                  <button
                    key={plan.plan}
                    onClick={() => setSelectedPlan(plan.plan)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all duration-150',
                      selectedPlan === plan.plan
                        ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    )}
                  >
                    <p className="text-xs font-bold text-white/60 uppercase tracking-wider">{PLAN_LABELS[plan.plan]}</p>
                    <p className="text-xl font-black text-white mt-0.5">₹{plan.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      ₹{Math.round((plan.amount / (plan.duration_minutes / 43200)))}/mo
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Pay button */}
            <button
              onClick={handlePay}
              disabled={paying || loadingPlans || !selectedPlanData}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30"
            >
              {paying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                `Pay ₹${selectedPlanData?.amount.toLocaleString() ?? '...'} & Renew`
              )}
            </button>

            <p className="text-center text-white/20 text-[10px] mt-3">
              Secured by Razorpay · UPI / Card / Net Banking
            </p>

            {/* Sign out — only escape allowed */}
            <button
              onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
              className="mt-6 w-full flex items-center justify-center gap-2 text-white/30 hover:text-white/60 text-xs py-2 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Staff Blocked Screen ────────────────────────────────────────────────────
function StaffBlockedWall() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0F1F5C] flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Access Suspended</h1>
        <p className="text-white/50 text-sm leading-relaxed">
          This library's subscription has expired. Please ask your library owner to renew the subscription.
        </p>
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
          className="mt-8 flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-xs mx-auto transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </div>
  )
}

// ─── Main AuthGuard ──────────────────────────────────────────────────────────
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [renewalState, setRenewalState] = useState<{
    type: 'owner' | 'staff' | null
    library: any
    userId: string
  }>({ type: null, library: null, userId: '' })

  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        const publicRoutes = ['/login', '/forgot-password', '/reset-password']
        const isPublicRoute = publicRoutes.some(r => pathname.startsWith(r))

        if (!user) {
          if (!isPublicRoute) router.push('/login')
          return
        }

        if (isPublicRoute) { router.push('/'); return }

        const { data: staff } = await supabase
          .from('staff')
          .select('role, library_ids')
          .eq('user_id', user.id)
          .single()

        // Routes that bypass subscription check
        const bypassRoutes = ['/change-password', '/select-library', '/api']
        const isBypass = bypassRoutes.some(r => pathname.startsWith(r))

        if (!isBypass) {
          const libraryIds: string[] = staff?.library_ids || []

          // Read all active_library_id cookies (in case of domain vs host cookie conflicts)
          const getCookie = (name: string, validIds: string[]) => {
            if (typeof document === 'undefined') return null
            const matches = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`, 'g'))
            if (!matches) return null
            for (const match of matches) {
              const val = match.split('=')[1]
              if (validIds.includes(val)) return val
            }
            return null
          }

          const activeCookieId = getCookie('active_library_id', libraryIds)

          if (libraryIds.length > 1 && !activeCookieId) {
            router.push('/select-library'); return
          }

          const selectedLibId = activeCookieId || libraryIds[0]

          if (selectedLibId) {
            const { data: library } = await supabase
              .from('libraries')
              .select('id, name, subscription_end, subscription_status, delete_date')
              .eq('id', selectedLibId)
              .single()

            if (library) {
              const isExpired = new Date() > new Date(library.subscription_end)
              if (isExpired) {
                // Show the hard block — don't navigate away
                setRenewalState({
                  type: staff?.role === 'owner' ? 'owner' : 'staff',
                  library,
                  userId: user.id,
                })
                return // Don't clear loading yet — overlay handles it
              }
            }
          }
        }

        // Auth valid, clear any stale renewal state
        setRenewalState({ type: null, library: null, userId: '' })
      } catch (err) {
        console.error('Auth check failed', err)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [mounted, pathname, router])

  const handleRenewalSuccess = () => {
    setRenewalState({ type: null, library: null, userId: '' })
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      {/* Hard block overlay — rendered ABOVE everything, no escape */}
      {renewalState.type === 'owner' && renewalState.library && (
        <RenewalWall
          library={renewalState.library}
          userId={renewalState.userId}
          onSuccess={handleRenewalSuccess}
        />
      )}
      {renewalState.type === 'staff' && <StaffBlockedWall />}

      {/* Loading spinner */}
      {(!mounted || loading) && !renewalState.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
        </div>
      )}

      {children}
    </>
  )
}

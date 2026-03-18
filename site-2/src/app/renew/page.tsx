'use client'

export const runtime = "edge";

import { useEffect, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { AlertTriangle, Shield, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { callEdgeFunction } from '@/lib/api'

declare global {
  interface Window { Razorpay: any }
}

const PLANS = [
  { months: 1,  label: '1 Month',   price: 500  },
  { months: 3,  label: '3 Months',  price: 1200 },
  { months: 6,  label: '6 Months',  price: 2200 },
  { months: 12, label: '12 Months', price: 4000 },
]

export default function RenewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <RenewContent />
    </Suspense>
  )
}

function RenewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const libraryId = searchParams.get('library_id')

  const [library, setLibrary] = useState<any>(null)
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]) // default 3 months
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      // Get library id from param or first library
      let libId = libraryId
      if (!libId) {
        const cookieLibId = document.cookie.match(/active_library_id=([^;]+)/)?.[1]
        const { data: staff } = await supabaseBrowser
          .from('staff')
          .select('library_ids')
          .eq('user_id', user.id)
          .single()
        libId = cookieLibId || staff?.library_ids?.[0]
      }

      if (!libId) { router.push('/'); return }

      const { data: lib } = await supabaseBrowser
        .from('libraries')
        .select('id, name, city, subscription_end, delete_date')
        .eq('id', libId)
        .single()

      setLibrary(lib)
      setLoading(false)
    }
    load()

    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.head.appendChild(script)
  }, [libraryId, router])

  async function handlePay() {
    setPaying(true)
    try {
      // 1. Generate Token
      const { token } = await callEdgeFunction('generate-token', {
        body: {
          library_id: library.id,
          purpose: 'renew'
        },
        useAuthToken: true
      })

      // 2. Create order
      const { order_id, amount, key } = await callEdgeFunction('create-renewal-order', {
        body: {
          token,
          library_id: library.id,
          plan_months: selectedPlan.months,
        },
      })

      const options = {
        key,
        amount,
        currency: 'INR',
        name: 'LibraryOS',
        description: `${selectedPlan.label} Subscription — ${library.name}`,
        order_id,
        handler: async (response: any) => {
          // 3. Verify payment
          try {
            const data = await callEdgeFunction('verify-renewal', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                library_id: library.id,
                plan_months: selectedPlan.months,
              },
            })
            if (data.success) {
              setSuccess(true)
              // Clear cookie so middleware re-checks
              document.cookie = `active_library_id=${library.id}; path=/; max-age=2592000`
              setTimeout(() => router.push('/'), 2000)
            }
          } catch (err) {
            console.error('Payment verification failed', err)
          }
        },
        prefill: { name: library.name },
        theme: { color: '#2563EB' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (e) {
      console.error(e)
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center p-6">
        <div className="text-center animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-serif text-white">Renewed!</h2>
          <p className="text-white/60 mt-2 text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  const subEnd = new Date(library?.subscription_end)
  const today = new Date()
  const daysPast = Math.abs(Math.ceil((subEnd.getTime() - today.getTime()) / 86400000))
  const deleteDate = new Date(library?.delete_date)
  const daysUntilDelete = Math.ceil((deleteDate.getTime() - today.getTime()) / 86400000)

  return (
    <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Warning icon */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-serif text-white">Subscription Expired</h1>
          <p className="text-white/60 text-sm mt-1 font-medium">{library?.name}</p>
        </div>

        {/* Info card */}
        <div className="bg-white/5 rounded-2xl p-4 mb-6 space-y-2 border border-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Expired</span>
            <span className="text-red-400 font-bold">{daysPast} days ago</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Data safe until
            </span>
            <span className={cn(
              'font-bold',
              daysUntilDelete > 5 ? 'text-green-400' : 'text-red-400'
            )}>
              {daysUntilDelete > 0 ? `${daysUntilDelete} days` : 'Deleted'}
            </span>
          </div>
          <p className="text-white/40 text-[11px] pt-1 border-t border-white/5">
            All your student data is intact. Renew now to restore full access.
          </p>
        </div>

        {/* Plan selector */}
        <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Choose Plan</p>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {PLANS.map(plan => (
            <button
              key={plan.months}
              onClick={() => setSelectedPlan(plan)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all duration-150',
                selectedPlan.months === plan.months
                  ? 'bg-brand-500 border-brand-400 shadow-lg shadow-brand-500/30'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              )}
            >
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">{plan.label}</p>
              <p className="text-xl font-black text-white mt-0.5">₹{plan.price.toLocaleString()}</p>
              {plan.months >= 3 && (
                <p className="text-[10px] text-green-400 font-bold mt-0.5">
                  ₹{Math.round(plan.price / plan.months)}/mo
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full bg-brand-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-brand-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-xl shadow-brand-500/30"
        >
          {paying ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          ) : (
            `Pay ₹${selectedPlan.price.toLocaleString()} & Renew`
          )}
        </button>

        <p className="text-center text-white/30 text-[11px] mt-4">
          Secured by Razorpay · UPI / Card / Net Banking
        </p>
      </div>
    </div>
  )
}

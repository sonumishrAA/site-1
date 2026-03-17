'use client'

import { useState, useEffect } from 'react'
import { RegistrationData } from './RegistrationForm'
import Script from 'next/script'
import { callEdgeFunction } from '@/lib/api'
import { supabaseBrowser } from '@/lib/supabase/client'

interface DBPlan {
  plan: string
  amount: number
}

export default function Step7Payment({
  data,
  onSuccess,
  onBack,
}: {
  data: RegistrationData
  onSuccess: () => void
  onBack: () => void
}) {
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingPricing, setFetchingPricing] = useState(true)
  const [loadingText, setLoadingText] = useState('Initializing payment...')

  useEffect(() => {
    async function fetchPricing() {
      try {
        const { data: pricingData, error } = await supabaseBrowser
          .from('pricing_config')
          .select('*')
          .order('plan', { ascending: true })

        if (error) throw error
        
        const mappedPlans = [
          { id: '1m', label: '1 Month', price: pricingData.find(p => p.plan === '1m')?.amount || 500 },
          { id: '3m', label: '3 Months', price: pricingData.find(p => p.plan === '3m')?.amount || 1200 },
          { id: '6m', label: '6 Months', price: pricingData.find(p => p.plan === '6m')?.amount || 2200 },
          { id: '12m', label: '12 Months', price: pricingData.find(p => p.plan === '12m')?.amount || 4000 },
        ]
        
        setPlans(mappedPlans)
        setSelectedPlan(mappedPlans[0])
      } catch (err) {
        console.error('Failed to fetch pricing:', err)
      } finally {
        setFetchingPricing(false)
      }
    }
    fetchPricing()
  }, [])

  useEffect(() => {
    if (loading) {
      const texts = [
        'Verifying payment...',
        'Setting up your library...',
        'Creating your seats...',
        'Almost ready...',
      ]
      let i = 0
      const interval = setInterval(() => {
        i = (i + 1) % texts.length
        setLoadingText(texts[i])
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [loading])

  const handlePayment = async () => {
    if (!selectedPlan) return
    setLoading(true)
    setLoadingText('Initializing payment...')
    
    try {
      const { order_id, amount } = await callEdgeFunction('create-payment-order', {
        body: { 
          form_data: {
            ...data,
            plan: selectedPlan.id,
            amount: selectedPlan.price
          }, 
          plan: selectedPlan.id 
        }
      })

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_your_key', // Ensure this is in your env
        amount: amount * 100,
        currency: 'INR',
        name: 'LibraryOS',
        description: `Library Registration - ${selectedPlan.label}`,
        order_id: order_id,
        handler: async function (response: any) {
          setLoadingText('Verifying payment...')
          try {
            await callEdgeFunction('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }
            })
            
            onSuccess()
          } catch (err: any) {
            console.error('Verification error:', err)
            alert(err.message || 'Setup failed. Please contact support.')
            setLoading(false)
          }
        },
        prefill: {
          name: data.owner.name,
          email: data.owner.email,
          contact: data.owner.phone,
        },
        theme: {
          color: '#0F1F5C',
        },
        modal: {
          ondismiss: function() {
            setLoading(false)
          }
        }
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()

    } catch (err) {
      console.error(err)
      alert('Something went wrong during order creation')
      setLoading(false)
    }
  }

  if (fetchingPricing) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-medium">Fetching latest plans...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      <div className="space-y-1">
        <h2 className="text-xl font-serif text-brand-900">Choose your plan</h2>
        <p className="text-sm text-gray-600">Select a subscription plan for LibraryOS.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <label
            key={plan.id}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedPlan?.id === plan.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="plan"
              className="hidden"
              checked={selectedPlan?.id === plan.id}
              onChange={() => setSelectedPlan(plan)}
            />
            <div className="flex justify-between items-center">
              <div>
                <p className={`font-bold ${selectedPlan?.id === plan.id ? 'text-brand-700' : 'text-gray-800'}`}>
                  {plan.label}
                </p>
                <p className="text-xs text-gray-500">Full access to all features</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-brand-900 font-mono">₹{plan.price}</p>
                <p className="text-[10px] text-gray-600 uppercase">One-time payment</p>
              </div>
            </div>
          </label>
        ))}
      </div>

      {selectedPlan && (
        <div className="p-4 bg-gray-50 rounded-lg space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Plan: {selectedPlan.label}</span>
            <span className="font-mono">₹{selectedPlan.price}.00</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">GST (0%)</span>
            <span className="font-mono">₹0.00</span>
          </div>
          <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-brand-900">
            <span>Total Amount</span>
            <span className="font-mono">₹{selectedPlan.price}.00</span>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-600 font-medium hover:text-gray-600 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!selectedPlan || loading}
          onClick={handlePayment}
          className="bg-brand-500 text-white px-12 py-3 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-100 disabled:opacity-50"
        >
          Pay with Razorpay
        </button>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-brand-900 font-medium animate-pulse">{loadingText}</p>
          <p className="text-xs text-gray-600">Don't close this tab. Your payment is safe.</p>
        </div>
      )}
    </div>
  )
}

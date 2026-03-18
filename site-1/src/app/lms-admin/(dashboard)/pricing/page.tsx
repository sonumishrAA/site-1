'use client'

import React, { useState, useEffect } from 'react'
import { 
  Save, 
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  Zap
} from 'lucide-react'
import { format } from 'date-fns'
import { callEdgeFunction } from '@/lib/api'
import { Skeleton } from '@/components/ui/Skeleton'

interface PricingPlan {
  id: number
  plan: string
  amount: number
  duration_minutes: number
  updated_at?: string
}

// Human-readable label for a duration_minutes value
function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`
  if (minutes < 43200) return `${Math.round(minutes / 1440)} day(s)`
  if (minutes < 525600) return `${Math.round(minutes / 43200)} month(s)`
  return `${Math.round(minutes / 525600)} yr(s)`
}

// Preset options: label → minutes
const PRESETS = [
  { label: '10 min',  minutes: 10 },
  { label: '30 min',  minutes: 30 },
  { label: '1 Month', minutes: 43200 },
  { label: '2 Months', minutes: 86400 },
]

export default function PricingControl() {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const fetchPlans = async () => {
    setIsLoading(true)
    try {
      // update-pricing GET is public — no admin token needed
      const data = await callEdgeFunction('update-pricing', { method: 'GET' })
      if (data) setPlans(data)
    } catch (err) {
      console.error('Failed to fetch pricing:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handlePriceChange = (plan: string, value: string) => {
    setPlans(prev => prev.map(p => p.plan === plan ? { ...p, amount: parseInt(value) || 0 } : p))
  }

  const handleDurationChange = (plan: string, value: string) => {
    setPlans(prev => prev.map(p => p.plan === plan ? { ...p, duration_minutes: parseInt(value) || 0 } : p))
  }

  const applyPreset = (plan: string, minutes: number) => {
    setPlans(prev => prev.map(p => p.plan === plan ? { ...p, duration_minutes: minutes } : p))
  }

  const savePlan = async (plan: string, amount: number, duration_minutes: number) => {
    setIsSaving(plan)
    try {
      await callEdgeFunction('update-pricing', {
        method: 'PATCH',
        body: { plan, amount, duration_minutes },
        useAdminToken: true
      })
      
      setNotification({ type: 'success', message: `${plan.toUpperCase()} plan updated → ₹${amount} / ${durationLabel(duration_minutes)}` })
      fetchPlans()
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to update pricing' })
    } finally {
      setIsSaving(null)
      setTimeout(() => setNotification(null), 4000)
    }
  }


  return (
    <div className="space-y-10 max-w-5xl">
      <header>
        <h1 className="text-3xl font-serif text-brand-900 mb-1">Pricing Control</h1>
        <p className="text-gray-500 font-medium">Set plan prices and subscription durations. Use presets for quick testing or production setup.</p>
      </header>

      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Current Price</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Price (₹)</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Duration</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Quick Presets</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-6"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-6 py-6"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="px-6 py-6"><Skeleton className="h-10 w-28" /></td>
                    <td className="px-6 py-6"><Skeleton className="h-10 w-36" /></td>
                    <td className="px-6 py-6"><Skeleton className="h-8 w-64" /></td>
                    <td className="px-6 py-6 text-right"><Skeleton className="h-10 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50/30 transition-colors">
                    {/* Plan key */}
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-brand-900 uppercase tracking-widest">{plan.plan}</span>
                    </td>
                    
                    {/* Current from DB */}
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-mono font-bold text-gray-700">₹{plan.amount}</span>
                        <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                          {durationLabel(plan.duration_minutes)}
                        </span>
                      </div>
                    </td>
                    
                    {/* Price input */}
                    <td className="px-6 py-5">
                      <div className="relative w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                        <input 
                          type="number"
                          min="0"
                          value={plan.amount}
                          onChange={(e) => handlePriceChange(plan.plan, e.target.value)}
                          className="w-full pl-6 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                        />
                      </div>
                    </td>
                    
                    {/* Duration input with label */}
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="relative w-36">
                          <Timer className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                          <input 
                            type="number"
                            min="1"
                            value={plan.duration_minutes}
                            onChange={(e) => handleDurationChange(plan.plan, e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          />
                        </div>
                        <span className="text-[10px] text-brand-500 font-bold pl-1">
                          = {durationLabel(plan.duration_minutes)}
                        </span>
                      </div>
                    </td>
                    
                    {/* Quick presets */}
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5">
                        {PRESETS.map(preset => (
                          <button
                            key={preset.label}
                            onClick={() => applyPreset(plan.plan, preset.minutes)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all
                              ${plan.duration_minutes === preset.minutes
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
                              }`}
                          >
                            <Zap className="w-2.5 h-2.5" />
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    
                    {/* Save button */}
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => savePlan(plan.plan, plan.amount, plan.duration_minutes)}
                        disabled={isSaving !== null}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-brand-900 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {isSaving === plan.plan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 font-medium space-y-1">
        <p className="font-bold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Duration Guide</p>
        <p>• <strong>10 min</strong> = For testing — library expires 10 minutes after registration</p>
        <p>• <strong>1 Month</strong> = 43,200 minutes = Standard monthly plan</p>
        <p>• <strong>2 Months</strong> = 86,400 minutes = Bi-monthly plan</p>
        <p>• You can also type any custom number of minutes in the field above</p>
      </div>
    </div>
  )
}

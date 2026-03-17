'use client'

import { useState, useEffect } from 'react'
import { RegistrationData } from './RegistrationForm'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

const PLAN_MONTHS = [1, 3, 6, 12]

const SHIFT_COMBINATIONS = [
  'M', 'A', 'E', 'N',
  'MA', 'ME', 'MN', 'AE', 'AN', 'EN',
  'MAE', 'MAN', 'MEN', 'AEN',
  'MAEN'
]

export default function Step4Pricing({
  data,
  onNext,
  onBack,
}: {
  data: RegistrationData
  onNext: (combos: RegistrationData['combos']) => void
  onBack: () => void
}) {
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 3, 6, 12])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPricing() {
      try {
        console.log('Fetching base pricing for registration...')
        const { data: pricingData } = await supabaseBrowser
          .from('pricing_config')
          .select('*')

        // Use 500 as requested. If DB has a value > 10, use it, otherwise use 500.
        // This prevents test values like '1' from overriding the requested default.
        const baseFromDB = Number(pricingData?.find(p => p.plan === '1m')?.amount || 0)
        const baseMonthly = baseFromDB > 10 ? baseFromDB : 500
        console.log('Using base monthly price:', baseMonthly)

        const initialPrices: Record<string, number> = {}
        SHIFT_COMBINATIONS.forEach(combo => {
          const shiftCount = combo.length
          const calculatedBase = shiftCount * baseMonthly
          
          PLAN_MONTHS.forEach(months => {
            const key = `${combo}-${months}`
            const existing = data.combos.find(c => c.combination_key === combo && c.months === months)
            
            if (existing) {
              initialPrices[key] = existing.fee
            } else {
              // Apply standard bulk discounts if not already set
              const multiplier = months === 3 ? 2.4 : months === 6 ? 4.4 : months === 12 ? 8 : months
              initialPrices[key] = calculatedBase * multiplier
            }
          })
        })
        setPrices(initialPrices)
      } catch (err) {
        console.error('Failed to load pricing for registration step:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPricing()
  }, [])

  const toggleMonth = (m: number) => {
    setSelectedMonths(prev => 
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const handlePriceChange = (combo: string, months: number, value: string) => {
    const numValue = parseFloat(value) || 0
    setPrices(prev => ({ ...prev, [`${combo}-${months}`]: numValue }))
  }

  const onSubmit = () => {
    const finalCombos = SHIFT_COMBINATIONS.flatMap(combo => 
      selectedMonths.map(months => ({
        combination_key: combo,
        months,
        fee: prices[`${combo}-${months}`] || 0
      }))
    )
    onNext(finalCombos)
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-gray-500 font-medium">Loading pricing structure...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-serif text-brand-900">Plans & Pricing</h2>
        <p className="text-sm text-gray-600">Which plans will you offer to your students? Set the total fee for each.</p>
      </div>

      <div className="space-y-6">
        {/* Month Selection */}
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="w-full text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Offer Plans for:</p>
          {PLAN_MONTHS.map(m => (
            <label key={m} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMonths.includes(m)}
                onChange={() => toggleMonth(m)}
                className="w-4 h-4 text-brand-500 rounded border-gray-300 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-gray-700">{m} Month{m > 1 ? 's' : ''}</span>
            </label>
          ))}
        </div>

        {/* Pricing Grid */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 border-b border-gray-200">Combination</th>
                {selectedMonths.sort((a,b)=>a-b).map(m => (
                  <th key={m} className="px-4 py-3 border-b border-gray-200">{m} Month{m > 1 ? 's' : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SHIFT_COMBINATIONS.map(combo => (
                <tr key={combo} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-brand-700 font-mono">{combo}</td>
                  {selectedMonths.map(m => (
                    <td key={m} className="px-4 py-3">
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-[10px] text-gray-600">₹</span>
                        <input
                          type="number"
                          value={prices[`${combo}-${m}`] || ''}
                          onChange={(e) => handlePriceChange(combo, m, e.target.value)}
                          className="w-24 pl-5 pr-2 py-1.5 text-xs rounded border border-gray-200 focus:border-brand-500 focus:ring-brand-500 font-mono"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
          onClick={onSubmit}
          className="bg-brand-500 text-white px-8 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors shadow-sm"
        >
          Next Step →
        </button>
      </div>
    </div>
  )
}

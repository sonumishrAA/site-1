'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Plus, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import RegistrationForm, { RegistrationData } from '@/components/RegistrationForm/RegistrationForm'
import { cn } from '@/lib/utils'

function AddLibraryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<any>(null)
  
  const [proceedingToForm, setProceedingToForm] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Missing token. Please initiate adding a library from your dashboard.')
      setLoading(false)
      return
    }

    async function verify() {
      try {
        const res = await fetch(`/api/verify-token?token=${token}&purpose=add-library`)
        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Verification failed')
        
        setPayload(data.payload)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2rem] p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
          </div>
          <a href="https://app.libraryos.in/settings" className="block w-full py-3 bg-brand-900 text-white rounded-xl font-bold mt-4">
            Return to Dashboard
          </a>
        </div>
      </div>
    )
  }

  if (proceedingToForm) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif text-brand-900 mb-2">Add New Library Branch</h1>
            <p className="text-sm font-bold text-green-600 bg-green-50 inline-flex items-center gap-2 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" /> Adding to existing account: {payload.owner_email}
            </p>
          </div>
          <RegistrationForm 
            initialOwner={{ 
              name: payload.owner_name || payload.owner_email.split('@')[0], 
              email: payload.owner_email,
              phone: payload.owner_phone || '0000000000',
              isVerified: true,
              isExisting: true
            }} 
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-8 text-center shadow-xl animate-in slide-in-from-bottom-4">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-500 shadow-sm border border-brand-100">
          <Plus className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif text-brand-900 mb-2">Verified Session</h2>
        <p className="text-sm font-medium text-gray-600 mb-6">
          You are expanding your business as <span className="text-brand-700 font-bold">{payload.owner_email}</span>.
        </p>
        
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-left mb-8 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
            By proceeding, a new library branch will be added to your existing account. You will not need to create a new password.
          </p>
        </div>

        <button
          onClick={() => setProceedingToForm(true)}
          className="w-full bg-brand-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-800 transition-colors"
        >
          <Building2 className="w-5 h-5" />
          Continue to Configuration
        </button>
      </div>
    </div>
  )
}

export default function AddLibraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <AddLibraryContent />
    </Suspense>
  )
}

'use client'

export const runtime = "edge";

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { callEdgeFunction } from '@/lib/api'

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogout() {
    setLoading(true)
    setError(null)
    try {
      await supabaseBrowser.auth.signOut()
      document.cookie = 'active_library_id=; path=/; max-age=0'
      router.push('/login')
      router.refresh()
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: updateError } = await supabaseBrowser.auth.updateUser({
      password: password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
    } else {
      // Clear staff.force_password_change via edge function
      try {
        await callEdgeFunction('clear-password-flag', {
          method: 'POST'
        })
      } catch (err: any) {
        setError(err?.message || 'Password updated, but profile update failed. Please try again.')
        setLoading(false)
        return
      }
      
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="text-left">
            <h1 className="text-2xl font-serif text-brand-900">Change Password</h1>
            <p className="mt-2 text-sm text-gray-600">You are required to change your password on first login.</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-500 text-red-700 text-sm rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

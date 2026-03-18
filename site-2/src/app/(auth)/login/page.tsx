'use client'

export const runtime = "edge";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Mail, Eye, EyeOff, Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<{ message: string; type: 'auth' | 'network' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginData) => {
    setLoading(true)
    setError(null)

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setError({ message: 'No internet connection. Please check your data.', type: 'network' })
      setLoading(false)
      return
    }

    try {
      const { data: signInData, error: authError } = await supabaseBrowser.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) {
        setError({
          message: authError.message.includes('fetch') ? 'Network error. Check your connection.' : authError.message,
          type: authError.message.includes('fetch') ? 'network' : 'auth',
        })
        setLoading(false)
        return
      }

      const userId = signInData.user?.id
      if (!userId) {
        setError({ message: 'Login failed. Please try again.', type: 'auth' })
        setLoading(false)
        return
      }

      // Get staff to check library count
      const { data: staff, error: staffError } = await supabaseBrowser
        .from('staff')
        .select('library_ids')
        .eq('user_id', userId)
        .maybeSingle()

      if (staffError) {
        setError({ message: staffError.message || 'Unable to load staff profile.', type: 'auth' })
        setLoading(false)
        return
      }

      let libraryIds: string[] = staff?.library_ids || []

      // Fallback for older owner accounts that may not have a staff row yet.
      if (libraryIds.length === 0) {
        const { data: libs, error: libsError } = await supabaseBrowser
          .from('libraries')
          .select('id')
        if (!libsError && libs?.length) {
          libraryIds = libs.map(l => l.id)
        }
      }

      if (libraryIds.length === 0) {
        await supabaseBrowser.auth.signOut()
        document.cookie = 'active_library_id=; path=/; max-age=0'
        setError({ message: 'Your account is not linked to any library. Please contact the owner.', type: 'auth' })
        setLoading(false)
        return
      }

      if (libraryIds.length > 1) {
        // Multiple libraries → clear old selection, let user pick
        document.cookie = 'active_library_id=; path=/; max-age=0'
        router.push('/select-library')
      } else if (libraryIds.length === 1) {
        // Single library → set cookie and go to dashboard
        document.cookie = `active_library_id=${libraryIds[0]}; path=/; max-age=2592000`
        router.push('/')
      } else {
        router.push('/')
      }
      router.refresh()
    } catch {
      setError({ message: 'Unable to connect. Please try again.', type: 'network' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 font-sans">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-brand-100">
            <span className="text-2xl font-serif font-bold text-brand-700">L</span>
          </div>
          <h1 className="text-3xl font-serif text-brand-900">LibraryOS</h1>
          <p className="text-sm text-gray-500 font-medium">Log in to manage your library</p>
        </div>

        {error && (
          <div className={cn(
            'p-4 rounded-xl border animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center text-center gap-2',
            error.type === 'network' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'
          )}>
            {error.type === 'network' && (
              <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
                <WifiOff className="w-4 h-4 text-amber-600" />
              </div>
            )}
            <p className="text-[10px] font-bold uppercase tracking-widest">
              {error.type === 'network' ? 'Connection Error' : 'Login Failed'}
            </p>
            <p className="text-xs font-semibold leading-tight">{error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className={`block w-full rounded-xl border ${errors.email ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-10 py-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all outline-none text-gray-800`}
                placeholder="owner@example.com"
              />
            </div>
            {errors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
              <button type="button" onClick={() => router.push('/forgot-password')}
                className="text-[10px] font-bold text-brand-500 hover:underline uppercase tracking-wider">
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`block w-full rounded-xl border ${errors.password ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-10 py-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all outline-none text-gray-800`}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Need an account?{' '}
          <a href="https://libraryos.in/library-register" className="text-brand-500 font-bold hover:underline" target="_blank" rel="noreferrer">
            Register your library
          </a>
        </p>
      </div>
    </div>
  )
}

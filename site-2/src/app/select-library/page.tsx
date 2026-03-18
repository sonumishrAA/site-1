'use client'

export const runtime = "edge";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Building2, CheckCircle2, AlertTriangle, Clock, ChevronRight, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { callEdgeFunction } from '@/lib/api'

interface Library {
  id: string
  name: string
  city: string
  subscription_end: string
  subscription_status: string
}

interface LibraryWithStats extends Library {
  studentCount: number
  daysLeft: number
  isExpired: boolean
}

export default function SelectLibraryPage() {
  const router = useRouter()
  const [libraries, setLibraries] = useState<LibraryWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const { data: staff } = await supabaseBrowser
        .from('staff')
        .select('library_ids, role')
        .eq('user_id', user.id)
        .single()

      if (!staff?.library_ids?.length) { router.push('/'); return }

      // If only 1 library, skip selection
      if (staff.library_ids.length === 1) {
        document.cookie = `active_library_id=${staff.library_ids[0]}; path=/; max-age=2592000`
        router.push('/')
        return
      }

      const { data: libs } = await supabaseBrowser
        .from('libraries')
        .select('id, name, city, subscription_end, subscription_status')
        .in('id', staff.library_ids)
        .order('name')

      if (!libs) return

      // Get student counts
      const today = new Date()
      const enriched: LibraryWithStats[] = await Promise.all(
        libs.map(async lib => {
          const { count } = await supabaseBrowser
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('library_id', lib.id)
            .eq('is_deleted', false)

          const subEnd = new Date(lib.subscription_end)
          const daysLeft = Math.ceil((subEnd.getTime() - today.getTime()) / 86400000)

          return {
            ...lib,
            studentCount: count || 0,
            daysLeft,
            isExpired: daysLeft < 0,
          }
        })
      )

      setLibraries(enriched)
      setRole(staff.role || 'staff')
      setLoading(false)
    }
    load()
  }, [router])

  const [role, setRole] = useState('staff')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  async function selectLibrary(lib: LibraryWithStats) {
    if (lib.isExpired) {
      if (role !== 'owner') {
        alert('This library is expired. Only the owner can renew it.')
        return
      }

      setLoadingAction(lib.id)
      try {
        const data = await callEdgeFunction('generate-token', {
          body: { library_id: lib.id, purpose: 'renew' },
          libraryId: lib.id
        })
        
        // Redirect to Site 1
        window.location.href = `https://libraryos.in/renew?token=${data.token}`
      } catch (err: any) {
        alert(err.message)
        setLoadingAction(null)
      }
      return
    }

    // Set cookie for 30 days
    document.cookie = `active_library_id=${lib.id}; path=/; max-age=2592000`
    router.push('/')
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-serif text-white">Select Library</h1>
        <p className="text-white/60 text-sm mt-2 font-medium">Choose which library to manage</p>
      </div>

      {/* Library Cards */}
      <div className="w-full max-w-sm space-y-3">
        {libraries.map((lib, i) => (
          <button
            key={lib.id}
            onClick={() => selectLibrary(lib)}
            style={{ animationDelay: `${i * 80}ms` }}
            className={cn(
              'w-full p-5 rounded-2xl border text-left transition-all duration-200 active:scale-[0.97] hover:scale-[1.01]',
              'animate-in fade-in slide-in-from-bottom-3',
              lib.isExpired
                ? 'bg-red-500/10 border-red-400/30 hover:bg-red-500/20'
                : 'bg-white/10 border-white/20 hover:bg-white/15'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black',
                  lib.isExpired ? 'bg-red-400/20 text-red-300' : 'bg-white/10 text-white'
                )}>
                  {loadingAction === lib.id ? (
                    <div className="w-4 h-4 rounded-full border-2 border-current border-t-white/30 animate-spin" />
                  ) : (
                    lib.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-tight">{lib.name}</p>
                  <p className="text-white/50 text-[11px] font-medium mt-0.5">{lib.city} · {lib.studentCount} students</p>
                </div>
              </div>
              <ChevronRight className={cn('w-5 h-5', lib.isExpired ? 'text-red-400' : 'text-white/40')} />
            </div>

            {/* Status Badge */}
            <div className="mt-3 flex items-center gap-2">
              {lib.isExpired ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest">
                    Expired {Math.abs(lib.daysLeft)} days ago · {role === 'owner' ? 'Tap to renew' : 'Owner access required'}
                  </span>
                </>
              ) : lib.daysLeft <= 7 ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                    Expiring in {lib.daysLeft} days
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[11px] font-bold text-green-400 uppercase tracking-widest">
                    Active · {lib.daysLeft} days left
                  </span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-8 flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm font-medium"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  )
}

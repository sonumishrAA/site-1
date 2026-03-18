'use client'

export const runtime = "edge";

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Lock, LogOut } from 'lucide-react'

export default function BlockedPage() {
    const router = useRouter()

    async function handleLogout() {
        await supabaseBrowser.auth.signOut()
        document.cookie = 'active_library_id=; path=/; max-age=0'
        router.push('/login')
    }

    return (
        <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-6">
            <div className="text-center max-w-xs animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                    <Lock className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-2xl font-serif text-white mb-3">Access Restricted</h1>
                <p className="text-white/50 text-sm leading-relaxed mb-2">
                    This library&apos;s subscription has expired.
                </p>
                <p className="text-white/40 text-sm leading-relaxed mb-8">
                    Please contact the library owner to renew the subscription and restore access.
                </p>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-8">
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-1">What to do</p>
                    <p className="text-white/60 text-sm">Ask the owner to log in and renew the subscription. Your account and data are safe.</p>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm font-medium mx-auto"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </div>
    )
}
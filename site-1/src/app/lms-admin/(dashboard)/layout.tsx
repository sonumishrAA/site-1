'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Library, 
  CreditCard, 
  MessageSquare, 
  LogOut,
  BookOpen
} from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [adminEmail, setAdminEmail] = useState('admin@libraryos.in')
  const [isAuthChecked, setIsAuthChecked] = useState(false)

  useEffect(() => {
    // Guard: if no admin token, redirect to login immediately
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.replace('/lms-admin/login')
      return
    }
    setIsAuthChecked(true)
  }, [pathname, router])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    router.push('/lms-admin/login')
  }

  // Don't render anything until auth is confirmed — prevents edge function calls with no token
  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-[#0F1F5C] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/50" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#1e293b] font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#0F1F5C] text-white fixed h-screen flex flex-col z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-brand-500 p-1.5 rounded-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-lg font-bold tracking-tight">LibraryOS</span>
          <span className="bg-[#3B82F6] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-1">Admin</span>
        </div>

        <nav className="mt-8 flex-1 px-4 space-y-1">
          <NavItem href="/lms-admin" icon={<LayoutDashboard className="w-5 h-5" />} label="Overview" />
          <NavItem href="/lms-admin/libraries" icon={<Library className="w-5 h-5" />} label="Libraries" />
          <NavItem href="/lms-admin/pricing" icon={<CreditCard className="w-5 h-5" />} label="Pricing" />
          <NavItem href="/lms-admin/messages" icon={<MessageSquare className="w-5 h-5" />} label="Messages" />
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <div className="text-[12px] text-gray-400 truncate font-medium">
            {adminEmail}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-[260px] flex-1 p-10">
        <div className="max-w-[1000px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

function NavItem({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  return (
    <Link 
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-all group"
    >
      <span className="group-hover:text-white transition-colors">
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}

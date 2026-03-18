import AppHeader from '@/components/layout/AppHeader'
import BottomNav from '@/components/layout/BottomNav'
import SubscriptionBanner from '@/components/layout/SubscriptionBanner'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveLibraryId } from '@/lib/getActiveLibrary'

export const runtime = 'edge';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get library context for subscription banner
  const { data: staff } = await supabase
    .from('staff')
    .select('library_ids')
    .eq('user_id', user.id)
    .single()

  const libraryId = await getActiveLibraryId(user.id, staff?.library_ids || [])
  let daysLeft = 999 // default: far from expiring

  if (libraryId) {
    const { data: library } = await supabase
      .from('libraries')
      .select('subscription_end')
      .eq('id', libraryId)
      .single()

    if (library?.subscription_end) {
      daysLeft = Math.ceil(
        (new Date(library.subscription_end).getTime() - Date.now()) / 86400000
      )
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 pb-20">
      <AppHeader />
      <SubscriptionBanner daysLeft={daysLeft} />
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

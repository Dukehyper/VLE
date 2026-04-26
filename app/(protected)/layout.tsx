import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'
import { SettingsProvider } from '@/components/SettingsContext'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isSettingsPage = pathname.includes('/settings')

  if (!settings && !isSettingsPage) {
    redirect('/settings')
  }

  return (
    <SettingsProvider>
      <div className="pb-24 page-enter">
        {children}
      </div>
      <BottomNav />
    </SettingsProvider>
  )
}

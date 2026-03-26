import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@masjid/database'
import { Sidebar } from '../../components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const clerkId = (await headers()).get('x-clerk-user-id')
  if (!clerkId) redirect('/sign-in')

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      mosqueAdmins: {
        include: { mosque: { select: { id: true, name: true, slug: true, isVerified: true } } },
      },
    },
  })

  // Super admins can access dashboard even without a mosque
  if (!user) redirect('/sign-in')
  if (user.mosqueAdmins.length === 0 && !user.isSuperAdmin) redirect('/onboarding')

  return (
    <div className="flex h-screen" style={{ background: '#F4F0E6' }}>
      <Sidebar
        user={{ name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin }}
        mosques={user.mosqueAdmins.map((a) => ({ ...a.mosque, role: a.role }))}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

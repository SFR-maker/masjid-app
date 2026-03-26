import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@masjid/database'

export default async function RootPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { mosqueAdmins: { select: { mosqueId: true } } },
  })

  if (!user) redirect('/sign-in')

  if (user.isSuperAdmin && user.mosqueAdmins.length === 0) {
    redirect('/admin/mosque-import')
  }

  if (user.mosqueAdmins.length === 0) {
    redirect('/onboarding')
  }

  redirect(`/${user.mosqueAdmins[0].mosqueId}`)
}

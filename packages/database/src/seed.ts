import { prisma } from './index'

async function main() {
  console.log('Seeding database...')

  const mosque = await prisma.mosqueProfile.upsert({
    where: { slug: 'islamic-center-of-downtown' },
    update: {},
    create: {
      name: 'Islamic Center of Downtown',
      slug: 'islamic-center-of-downtown',
      description:
        "A welcoming mosque serving the downtown community since 1985. We offer daily prayers, Jumu'ah, and various educational programs.",
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      latitude: 40.7128,
      longitude: -74.006,
      phone: '+1-212-555-0100',
      email: 'info@icd.org',
      website: 'https://icd.org',
      imamName: 'Sheikh Ahmad Al-Rahman',
      hasWomensPrayer: true,
      hasYouthPrograms: true,
      hasParking: false,
      isAccessible: true,
      languages: ['English', 'Arabic', 'Urdu'],
      khutbahLanguages: ['English', 'Arabic'],
      isVerified: true,
      verifiedAt: new Date(),
    },
  })

  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    date.setHours(0, 0, 0, 0)

    await prisma.prayerSchedule.upsert({
      where: { mosqueId_date: { mosqueId: mosque.id, date } },
      update: {},
      create: {
        mosqueId: mosque.id,
        date,
        fajrAdhan: '05:30',
        fajrIqamah: '05:45',
        sunriseTime: '07:00',
        dhuhrAdhan: '12:30',
        dhuhrIqamah: '12:45',
        asrAdhan: '15:45',
        asrIqamah: '16:00',
        maghribAdhan: '18:15',
        maghribIqamah: '18:20',
        ishaAdhan: '19:45',
        ishaIqamah: '20:00',
      },
    })
  }

  await prisma.jumuahSchedule.create({
    data: {
      mosqueId: mosque.id,
      khutbahTime: '13:00',
      iqamahTime: '13:30',
      language: 'English',
      imam: 'Sheikh Ahmad Al-Rahman',
      notes: 'Two khutbahs: 1:00 PM and 2:00 PM',
      isActive: true,
    },
  })

  await prisma.event.create({
    data: {
      mosqueId: mosque.id,
      title: 'Weekly Halaqa — Purification of the Soul',
      description: 'Join us for our weekly halaqa with Sheikh Ahmad. This week: Tazkiyah and the heart.',
      category: 'HALAQA',
      startTime: new Date(Date.now() + 3 * 86400000),
      endTime: new Date(Date.now() + 3 * 86400000 + 7200000),
      location: 'Main Hall',
      requiresRsvp: true,
    },
  })

  await prisma.announcement.create({
    data: {
      mosqueId: mosque.id,
      title: 'Ramadan Schedule Now Available',
      body: 'Alhamdulillah, our full Ramadan prayer and iftar schedule is now posted. Please check the prayer times section for details. May Allah accept our worship.',
      priority: 'IMPORTANT',
      isPinned: true,
    },
  })

  console.log('✅ Seed complete. Mosque:', mosque.name)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

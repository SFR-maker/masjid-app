import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support — Masjidly',
  description: 'Get help with the Masjidly app',
}

export default function SupportPage() {
  const faqs = [
    {
      q: 'How do I find my local mosque?',
      a: 'Open the app and tap "Discover" at the bottom. Allow location access to see mosques near you, or search by city name.',
    },
    {
      q: 'How do I follow a mosque?',
      a: 'Open any mosque profile and tap the "Follow" button. You\'ll receive push notifications for their prayer times, events, and announcements.',
    },
    {
      q: 'How do I turn off notifications?',
      a: 'Go to your Profile → Settings → Notifications. You can toggle notifications per mosque or by type (prayer times, events, announcements).',
    },
    {
      q: 'I\'m a mosque admin. How do I set up my mosque?',
      a: 'Download the app, create an account, and visit masjid-app-admin.vercel.app to access the admin dashboard. You can manage prayer times, events, announcements, and more.',
    },
    {
      q: 'How do I delete my account?',
      a: 'Go to Profile → Settings → Account → Delete Account. Your data will be permanently removed within 30 days.',
    },
    {
      q: 'The prayer times for my mosque are wrong. What do I do?',
      a: 'Prayer times are set by the mosque\'s administrators. Please contact your mosque directly, or use the in-app messaging feature to send them a message.',
    },
    {
      q: 'How do I report inappropriate content?',
      a: 'Tap the three-dot menu on any post or video and select "Report." Our moderation team reviews all reports within 24–48 hours.',
    },
    {
      q: 'Is Masjidly free?',
      a: 'Yes, Masjidly is completely free to download and use.',
    },
  ]

  return (
    <div className="min-h-screen bg-cream-100 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-forest-gradient flex items-center justify-center">
              <span className="text-white text-lg">🕌</span>
            </div>
            <span className="font-fraunces text-2xl font-bold text-forest-900">Masjidly</span>
          </div>
          <h1 className="font-fraunces text-4xl font-bold text-forest-900 mb-3">Support</h1>
          <p className="text-forest-600 text-base">How can we help?</p>
        </div>

        {/* Contact card */}
        <div className="bg-forest-gradient rounded-2xl p-6 mb-8 text-white">
          <h2 className="font-fraunces text-xl font-bold mb-2">Contact Us</h2>
          <p className="text-forest-100 text-sm mb-4">Can't find what you're looking for? Our team responds within 24 hours.</p>
          <a
            href="mailto:support@masjidly.app"
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <span>✉️</span>
            support@masjidly.app
          </a>
        </div>

        {/* FAQs */}
        <h2 className="font-fraunces text-2xl font-bold text-forest-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-warm-sm border border-cream-200">
              <h3 className="font-semibold text-forest-900 mb-2">{faq.q}</h3>
              <p className="text-forest-700 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        {/* Mosque admin link */}
        <div className="mt-8 bg-gold-light rounded-2xl p-6 border border-gold/20">
          <h2 className="font-fraunces text-xl font-bold text-forest-900 mb-2">Are you a mosque administrator?</h2>
          <p className="text-forest-700 text-sm mb-4">Access the full admin dashboard to manage prayer times, events, videos, and your community.</p>
          <a
            href="https://masjid-app-admin.vercel.app"
            className="inline-flex items-center gap-2 bg-forest-gradient rounded-xl px-4 py-2.5 text-white text-sm font-semibold"
          >
            Open Admin Dashboard →
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-cream-300 text-center text-sm text-forest-400">
          © {new Date().getFullYear()} Masjidly · <a href="/privacy" className="underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  )
}

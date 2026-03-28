import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Masjidly',
  description: 'Terms of Service for the Masjidly app',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream-100 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-forest-gradient flex items-center justify-center">
              <span className="text-white text-lg">🕌</span>
            </div>
            <span className="font-fraunces text-2xl font-bold text-forest-900">Masjidly</span>
          </div>
          <h1 className="font-fraunces text-4xl font-bold text-forest-900 mb-3">Terms of Service</h1>
          <p className="text-forest-500 text-sm">Last updated: March 28, 2026 &nbsp;·&nbsp; Effective: March 28, 2026</p>
        </div>

        <div className="space-y-4">
          <Section title="1. Acceptance of Terms">
            <p>By downloading, installing, or using the Masjidly mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App.</p>
            <p>We reserve the right to update these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Masjidly is a platform that connects Muslim community members with local mosques. The App allows users to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Discover nearby mosques and access their prayer schedules</li>
              <li>Follow mosques to receive announcements and event notifications</li>
              <li>RSVP to mosque events and view community videos</li>
              <li>Make charitable donations directly to mosques</li>
              <li>Communicate with mosque administration</li>
            </ul>
            <p>Masjidly is a technology platform only. We are not a mosque and do not provide religious services.</p>
          </Section>

          <Section title="3. User Accounts">
            <p>You must create an account to access certain features. You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Providing accurate and complete registration information</li>
            </ul>
            <p>You must be at least 13 years old to create an account. Accounts found to be used by persons under 13 will be terminated.</p>
          </Section>

          <Section title="4. User-Generated Content">
            <p>You may post content including comments, messages, and responses to polls ("User Content"). By posting, you grant Masjidly a non-exclusive, royalty-free license to use, display, and distribute your User Content within the App.</p>
            <p>You agree not to post content that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Is false, misleading, or fraudulent</li>
              <li>Is hateful, harassing, or discriminatory</li>
              <li>Violates any applicable law or regulation</li>
              <li>Infringes the intellectual property rights of others</li>
              <li>Contains spam, malware, or unauthorized advertising</li>
            </ul>
            <p>We reserve the right to remove any User Content that violates these Terms without notice.</p>
          </Section>

          <Section title="5. Donations">
            <p>The App facilitates charitable donations from users directly to mosques. By making a donation:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You authorize the charge to your payment method</li>
              <li>You acknowledge that <strong>donations go directly to the mosque</strong>, not to Masjidly</li>
              <li>You understand that Masjidly is not responsible for how mosques use donated funds</li>
              <li>Donations are generally non-refundable; contact the mosque directly for refund requests</li>
              <li>Payments are processed by Stripe. By donating, you also agree to <a href="https://stripe.com/legal" className="text-forest-500 underline" target="_blank" rel="noopener">Stripe's Terms of Service</a></li>
            </ul>
          </Section>

          <Section title="6. Mosque Administrators">
            <p>If you manage a mosque profile on Masjidly, you additionally agree to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide accurate information about your mosque</li>
              <li>Only post content on behalf of your mosque that is truthful and appropriate</li>
              <li>Use donation features only for legitimate charitable purposes</li>
              <li>Maintain the security of your admin account</li>
            </ul>
          </Section>

          <Section title="7. Prohibited Uses">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the App for any unlawful purpose</li>
              <li>Attempt to access other users' accounts or data without authorization</li>
              <li>Reverse engineer, decompile, or disassemble the App</li>
              <li>Use automated means (bots, scrapers) to access the App</li>
              <li>Interfere with the App's security features or infrastructure</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>The App, including its design, code, and content (excluding User Content), is owned by Masjidly and protected by copyright and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our written permission.</p>
          </Section>

          <Section title="9. Disclaimers">
            <p>THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. MASJIDLY DOES NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.</p>
            <p>Prayer times are provided by mosque administrators. Masjidly does not guarantee the accuracy of prayer times, event details, or other mosque-provided information.</p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, MASJIDLY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE APP, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, OR PERSONAL INJURY.</p>
          </Section>

          <Section title="11. Termination">
            <p>We may suspend or terminate your account at any time for violation of these Terms or for any other reason, with or without notice. You may delete your account at any time through the App settings.</p>
          </Section>

          <Section title="12. Governing Law">
            <p>These Terms are governed by the laws of the State of [Your State], United States, without regard to conflict of law principles.</p>
          </Section>

          <Section title="13. Contact">
            <p>For questions about these Terms, contact us at <a href="mailto:legal@masjidly.app" className="text-forest-500 underline">legal@masjidly.app</a>.</p>
          </Section>
        </div>

        <div className="mt-12 pt-8 border-t border-cream-300 text-center text-sm text-forest-400">
          © {new Date().getFullYear()} Masjidly ·{' '}
          <a href="/privacy" className="underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-warm-sm border border-cream-200">
      <h2 className="font-fraunces text-xl font-bold text-forest-900 mb-4">{title}</h2>
      <div className="space-y-3 text-forest-700 leading-relaxed text-sm">{children}</div>
    </div>
  )
}

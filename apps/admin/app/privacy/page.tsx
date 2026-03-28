import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Masjidly',
  description: 'Privacy Policy for the Masjidly mobile app',
}

export default function PrivacyPage() {
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
          <h1 className="font-fraunces text-4xl font-bold text-forest-900 mb-3">Privacy Policy</h1>
          <p className="text-forest-500 text-sm">Last updated: March 28, 2026 &nbsp;·&nbsp; Effective: March 28, 2026</p>
        </div>

        <div className="prose prose-forest max-w-none space-y-8 text-forest-800">

          <Section title="1. Introduction">
            <p>Masjidly ("we," "our," or "us") operates the Masjidly mobile application (the "App"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our App.</p>
            <p>Please read this policy carefully. If you disagree with its terms, please discontinue use of the App.</p>
          </Section>

          <Section title="2. Information We Collect">
            <h3 className="font-semibold text-forest-900 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> Email address, name, and profile photo (when you create an account)</li>
              <li><strong>Profile information:</strong> Optional bio, gender, city</li>
              <li><strong>User-generated content:</strong> Announcements, comments, poll responses, and messages you post</li>
            </ul>
            <h3 className="font-semibold text-forest-900 mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Device information:</strong> Device type, operating system version, unique device identifiers</li>
              <li><strong>Usage data:</strong> App features used, pages viewed, actions taken</li>
              <li><strong>Push notification token:</strong> To deliver prayer time and mosque announcement notifications</li>
              <li><strong>Crash reports:</strong> Automated crash logs to help us fix bugs</li>
            </ul>
            <h3 className="font-semibold text-forest-900 mt-4 mb-2">2.3 Location Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>When you use the mosque discovery feature, we request your approximate location to show nearby mosques</li>
              <li>Location is <strong>processed on-device and never stored on our servers</strong></li>
              <li>You can deny location permission and manually search for mosques by city name</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve the App</li>
              <li>Create and manage your account</li>
              <li>Deliver push notifications you have opted into</li>
              <li>Show mosques near your location (not stored)</li>
              <li>Enable community features (following mosques, RSVPs, messaging)</li>
              <li>Respond to your support requests</li>
              <li>Monitor for and prevent abuse or policy violations</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="4. How We Share Your Information">
            <p>We do <strong>not</strong> sell your personal information.</p>
            <p>We may share information with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Service providers:</strong> Clerk (authentication), Cloudinary (media), Railway (hosting), Expo (push notifications) — each bound by confidentiality obligations</li>
              <li><strong>Mosque administrators:</strong> When you RSVP to an event or message a mosque, that mosque's admin team can see your name and email</li>
              <li><strong>Legal requirements:</strong> If required by law, court order, or to protect our rights or user safety</li>
            </ul>
          </Section>

          <Section title="5. Data Retention">
            <ul className="list-disc pl-5 space-y-1">
              <li>Account data is retained while your account is active</li>
              <li>You may delete your account at any time via Settings → Account → Delete Account</li>
              <li>Upon deletion, your personal data is removed within 30 days</li>
              <li>Aggregated, anonymized usage data may be retained indefinitely</li>
            </ul>
          </Section>

          <Section title="6. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to access, correct, delete, or port your personal data, or to object to its processing. To exercise these rights, contact us at <a href="mailto:privacy@masjidly.app" className="text-forest-500 underline">privacy@masjidly.app</a>.</p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>The App is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If we learn we have collected information from a child under 13, we will delete it promptly.</p>
          </Section>

          <Section title="8. Security">
            <p>We implement industry-standard security measures including HTTPS/TLS encryption for all data in transit and access controls limiting who can access user data. No method of transmission is 100% secure and we cannot guarantee absolute security.</p>
          </Section>

          <Section title="9. Third-Party Services">
            <p>The App uses the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><a href="https://clerk.com/privacy" className="text-forest-500 underline" target="_blank" rel="noopener">Clerk</a> — authentication</li>
              <li><a href="https://cloudinary.com/privacy" className="text-forest-500 underline" target="_blank" rel="noopener">Cloudinary</a> — media hosting</li>
              <li><a href="https://expo.dev/privacy" className="text-forest-500 underline" target="_blank" rel="noopener">Expo</a> — push notifications</li>
              <li><a href="https://mux.com/privacy" className="text-forest-500 underline" target="_blank" rel="noopener">Mux</a> — video streaming</li>
            </ul>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy periodically. We will notify you of significant changes by updating the date above and, for material changes, by sending a notification through the App. Your continued use of the App after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>For privacy questions or requests:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email: <a href="mailto:privacy@masjidly.app" className="text-forest-500 underline">privacy@masjidly.app</a></li>
              <li>Website: <a href="https://masjidly.app" className="text-forest-500 underline">masjidly.app</a></li>
            </ul>
          </Section>
        </div>

        <div className="mt-12 pt-8 border-t border-cream-300 text-center text-sm text-forest-400">
          © {new Date().getFullYear()} Masjidly. All rights reserved.
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-warm-sm border border-cream-200">
      <h2 className="font-fraunces text-xl font-bold text-forest-900 mb-4">{title}</h2>
      <div className="space-y-3 text-forest-700 leading-relaxed">{children}</div>
    </div>
  )
}

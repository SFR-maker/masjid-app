# Masjidly — Store Submission Checklist

## Before You Submit

### 1. Prerequisites

#### Apple App Store
- [ ] Apple Developer account active ($99/year) — https://developer.apple.com
- [ ] App created in App Store Connect — https://appstoreconnect.apple.com
  - Bundle ID: `com.masjidapp.mobile`
  - Set App Store Connect App ID (needed in eas.json)
- [ ] Banking & tax info completed in App Store Connect
- [ ] Paid agreements signed

#### Google Play Store
- [ ] Google Play Developer account active ($25 one-time) — https://play.google.com/console
- [ ] App created in Play Console
  - Package: `com.masjidapp.mobile`
- [ ] Google Play Service Account created for EAS Submit
  - Go to Play Console → Setup → API Access → Create Service Account
  - Download JSON key → save as `apps/mobile/store/google-play-service-account.json`
  - **Never commit this file to Git** (already in .gitignore)
- [ ] Banking & tax info completed

---

### 2. Privacy Policy
- [ ] Host privacy policy at a public URL (e.g., https://masjidly.app/privacy)
- [ ] Content from `store/PRIVACY_POLICY.md` (customize with your actual business address)
- [ ] Add privacy policy URL to App Store Connect and Play Console

---

### 3. Screenshots (MOST TIME-CONSUMING — DO THIS FIRST)

#### iOS Screenshots
- [ ] iPhone 6.9" — 1320×2868 px (required for iOS 18+)
- [ ] iPhone 6.5" — 1242×2688 px (required)
- [ ] iPad Pro 12.9" — 2048×2732 px (required — you enabled tablet support)

**Minimum 3 per device, maximum 10.**

**Tip:** Use a tool like [Previewed.app](https://previewed.app) or [AppMockUp](https://app-mockup.com) to add device frames and marketing text.

#### Android Screenshots
- [ ] Phone — 1080×1920 px minimum (at least 2 required)
- [ ] Feature Graphic — 1024×500 px (required for Play Store header)
- [ ] 7" Tablet — optional but recommended

---

### 4. App Metadata
- [ ] Fill in App Store Connect listing from `store/ios/listing.md`
- [ ] Fill in Play Console listing from `store/android/listing.md`
- [ ] Create a demo account: demo@masjidly.app / DemoMasjidly2024! (or your own)
  - Add at least one mosque to this account
  - Pre-populate with some events, announcements, prayer times

---

### 5. Production Build

Run the production build (different from preview):
```bash
cd apps/mobile

# iOS + Android production builds
CI=1 npx eas build --platform all --profile production --non-interactive
```

**Note:** iOS production build requires:
- Distribution certificate (EAS manages automatically with `credentialsSource: remote`)
- Provisioning profile (EAS manages automatically)

**Build takes ~20-40 minutes on EAS servers.**

---

### 6. Update eas.json Credentials

Open `apps/mobile/eas.json` and fill in:
```json
"ios": {
  "appleId": "your-actual-apple-id@email.com",
  "ascAppId": "1234567890",       ← from App Store Connect app URL
  "appleTeamId": "XXXXXXXXXX"     ← from developer.apple.com/account
}
```

---

### 7. Submit to Stores

After production build completes:
```bash
# Submit iOS to App Store Connect (TestFlight first)
CI=1 npx eas submit --platform ios --profile production --latest

# Submit Android to Google Play Internal track
CI=1 npx eas submit --platform android --profile production --latest
```

---

### 8. iOS TestFlight
- [ ] Build appears in App Store Connect → TestFlight
- [ ] Add internal testers (your Apple ID and team)
- [ ] Submit for Beta App Review (required before external testers)
- [ ] Beta review takes ~1-2 business days
- [ ] Add external testers after beta approval
- [ ] When ready: promote from TestFlight → App Store distribution

### 9. iOS App Review
- [ ] Complete all metadata in App Store Connect
- [ ] Complete Privacy Nutrition Labels (Data Safety section)
- [ ] Complete App Review Information (demo credentials, notes)
- [ ] Complete content rating questionnaire
- [ ] Submit for Review
- [ ] **Review time: 1-3 business days** (first submission may take longer)

### 10. Android Play Review
- [ ] Upload AAB via EAS Submit → Internal testing track
- [ ] Test on internal track
- [ ] Promote to Closed testing (alpha) → Open testing (beta) → Production
- [ ] Complete Data Safety form in Play Console
- [ ] Complete Content Rating questionnaire (IARC)
- [ ] **Review time: 1-7 days for new apps**

---

## Common Rejection Reasons to Avoid

### Apple
- Missing privacy policy URL → Add to listing
- Demo account not working → Test before submitting
- Crashes on launch → Test production build on real device
- Incomplete metadata → Fill every required field
- Missing iPad screenshots → Add them (you support tablet)
- Privacy nutrition labels incomplete → Fill out data types

### Google
- Data Safety form incomplete → Fill out every question
- Missing feature graphic → Create 1024×500 graphic
- Target API level too old → Expo SDK 54 targets API 34+ ✓
- APK instead of AAB → Production build uses AAB ✓

---

## Post-Submission

- [ ] Monitor App Store Connect → Activity for review status
- [ ] Monitor Play Console → Release overview
- [ ] Respond to any reviewer questions within 24 hours
- [ ] Set up App Store notifications in App Store Connect
- [ ] Prepare launch announcement

---

## Quick Reference — Key URLs

| Service | URL |
|---------|-----|
| App Store Connect | https://appstoreconnect.apple.com |
| Apple Developer | https://developer.apple.com/account |
| Google Play Console | https://play.google.com/console |
| EAS Build Dashboard | https://expo.dev/accounts/[your-account]/projects/masjid-app/builds |
| EAS Project | https://expo.dev/projects/ba2f52fa-a888-42b6-80a9-d1500a0c5a70 |

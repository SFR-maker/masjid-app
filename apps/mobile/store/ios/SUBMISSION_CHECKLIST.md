# iOS App Store Submission Checklist

## Step 1 — Wait for Apple Developer Account Activation
- [ ] Apple Developer Program payment confirmed (processing)
- [ ] Account activation email received from Apple
- [ ] Can log into https://developer.apple.com/account and see your Team ID

---

## Step 2 — Create App in App Store Connect (5 min)

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps → +  → New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Masjidly
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** com.masjidapp.mobile  ← must match app.config.ts exactly
   - **SKU:** masjidly-001
4. Click **Create**
5. Note your **App ID** from the URL: `appstoreconnect.apple.com/apps/XXXXXXXXXX/...`

---

## Step 3 — Fill in eas.json (2 min)

Open `apps/mobile/eas.json` and replace the placeholders:

```json
"ios": {
  "appleId": "your@email.com",        ← your Apple ID login email
  "ascAppId": "1234567890",           ← App ID from Step 2
  "appleTeamId": "XXXXXXXXXX"         ← from developer.apple.com/account → Membership
}
```

---

## Step 4 — Run iOS Production Build (interactive, one time only)

```bash
cd apps/mobile
npx eas build --platform ios --profile production
```

EAS will ask you to sign in and set up certificates. Follow the prompts — it handles everything automatically. Build takes ~15 min.

---

## Step 5 — Fill Store Listing in App Store Connect

Go to your app → **App Store → 1.1.0 (Prepare for Submission)**

### App Information tab
- [ ] Name: `Masjidly`
- [ ] Subtitle: `Your Mosque Community App`
- [ ] Category: Social Networking / Reference
- [ ] Content Rights: Does not contain third-party content

### App Store tab (version 1.1.0)
- [ ] Promotional Text: (copy from listing.md)
- [ ] Description: (copy from listing.md)
- [ ] Keywords: `mosque,masjid,prayer times,islamic,muslim,quran,salah,jumu'ah,eid,halal,community,events,khutbah`
- [ ] Support URL: YOUR_VERCEL_ADMIN_URL/support
- [ ] Privacy Policy URL: YOUR_VERCEL_ADMIN_URL/privacy

### Screenshots
- [ ] Upload 5 screenshots from `store/ios/screenshots-6.9/` (iPhone 6.9")
- [ ] Upload 5 screenshots from `store/ios/screenshots-6.5/` (iPhone 6.5")

### App Review Information
- [ ] Sign-in required: **Yes**
- [ ] Demo email: `demo@masjidly.app`
- [ ] Demo password: `DemoMasjidly2024!`
- [ ] Notes: *This app connects Muslim communities with local mosques. Location is used only to find nearby mosques and is never stored server-side. Push notifications are opt-in.*

---

## Step 6 — App Privacy (Data Safety)

In App Store Connect → **App Privacy**:

| Data Type | Collected | Linked to User | Used to Track |
|-----------|-----------|----------------|---------------|
| Email address | Yes | Yes | No |
| User ID | Yes | Yes | No |
| Coarse location | Yes | No | No |
| App interactions | Yes | Yes | No |
| Crash data | Yes | No | No |

---

## Step 7 — Pricing & Availability
- [ ] Price: **Free**
- [ ] Availability: All territories (or remove specific countries if needed)

---

## Step 8 — Submit

```bash
npx eas submit --platform ios --profile production
```

Or manually in App Store Connect: click **Submit for Review**

### Before submitting, confirm:
- [ ] Build is attached to the version (EAS submit does this automatically)
- [ ] All required fields filled (App Store Connect will show red warnings for missing items)
- [ ] Export Compliance: **No** (ITSAppUsesNonExemptEncryption = false already set in app.config.ts)
- [ ] Advertising Identifier (IDFA): **No** (we don't use ad tracking)

---

## Step 9 — After Submission

- Apple review typically takes **24–48 hours**
- You'll get an email when approved or if they request changes
- Common rejection reasons for first-time apps:
  - Demo account doesn't work → make sure demo@masjidly.app is a real account
  - Privacy policy URL not loading → confirm Vercel is deployed
  - App crashes on launch → confirm build was from latest working code

---

## Files Ready
- `store/ios/listing.md` — full copy for all fields
- `store/ios/screenshots-6.9/` — 5 screenshots at 1320×2868 (iPhone 6.9")
- `store/ios/screenshots-6.5/` — 5 screenshots at 1242×2688 (iPhone 6.5")

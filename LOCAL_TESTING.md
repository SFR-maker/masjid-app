# Local Development & Testing Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (or Railway DB URL)
- Redis (local or Docker)
- Expo Go app on your phone, OR an iOS Simulator / Android emulator

## 1. Install dependencies

```bash
pnpm install
```

## 2. Environment variables

Create `.env` files in each app:

### `apps/api/.env`
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/masjid_dev
DIRECT_URL=postgresql://user:pass@localhost:5432/masjid_dev
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
```

### `apps/admin/.env.local`
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### `apps/mobile/.env.local`
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_PROJECT_ID=ba2f52fa-a888-42b6-80a9-d1500a0c5a70
```

## 3. Run Redis locally

```bash
docker run -d -p 6379:6379 redis:7-alpine
# or: brew services start redis
```

## 4. Run database migrations

```bash
cd packages/database
pnpm prisma migrate dev
pnpm prisma db seed   # if seed script exists
```

## 5. Start all services (3 terminals)

```bash
# Terminal 1 — API (port 3001)
cd apps/api && pnpm dev

# Terminal 2 — Admin (port 3002)
cd apps/admin && pnpm dev

# Terminal 3 — Mobile (port 8081)
cd apps/mobile && pnpm start -- --clear
```

Then scan the QR code with Expo Go on your phone.

---

## Testing Each Fix

### A. Quran Ayah Buzz (Android)
1. Open app → Quran tab → play any surah
2. Let it advance through 3+ ayahs
3. **Expected**: No vibration/buzz on ayah change. Notification bar updates silently.
4. If you had the old version installed, do a **fresh install** — Android caches channel settings per app install.

### B. Next Prayer Time / Countdown
1. Home screen → Prayer Times widget
2. **Before Isha**: widget shows correct next prayer with live countdown (updates every second)
3. **After Isha** (set device clock past last prayer): widget should show "NEXT PRAYER · TOMORROW" with tomorrow's Fajr time
4. No stale times — tap prayer tab to confirm

### C. Video Comments
1. Video tab → scroll to any video
2. Tap the chat bubble icon in the right rail
3. **Expected**: Bottom sheet slides up with comment list (or "No comments yet")
4. Type a comment and tap send — comment appears immediately
5. Sign-out state: shows "Sign in to leave a comment"
6. Mute icon: tap volume icon in rail to toggle audio

### D. Push Notifications
1. Ensure API is running with valid `CLERK_SECRET_KEY` and `REDIS_URL`
2. Sign in on mobile — check API logs for `[Push] registered token for userId ...` (add log if needed)
3. From admin, publish an announcement
4. **Expected**: Push notification received on device within ~5 seconds
5. API logs should show `[Push] mosque_announcement delivered to N/N devices`

### E. Notification Bar (Quran)
1. Start Quran playback, put app in background
2. Pull down notification center
3. **Expected**: Shows surah name (clean, no 🎵 emoji), ayah label on iOS appears as subtitle, reciter as body. Media controls: ⏮ Pause/Play ⏭

---

## Running Tests

```bash
# From repo root
pnpm --filter @masjid/mobile test

# Or directly:
cd apps/mobile
npx jest lib/__tests__/prayerUtils.test.ts --no-coverage
npx jest lib/__tests__/videoFeed.test.ts --no-coverage
```

---

## Widget Access (iOS)

The widget reads prayer data written by `usePrayerWidgetSync.ts` via shared AsyncStorage.

To add it to your home screen:
1. Long-press your iPhone home screen
2. Tap **+** (top-left corner)
3. Search for **"Masjid"**
4. Choose widget size and tap **Add Widget**

> Note: The widget requires a native iOS extension compiled into the app binary. It will only appear if the app was built via EAS Build (`eas build -p ios`). It won't be visible in Expo Go.

---

## Common Issues

| Problem | Fix |
|---|---|
| Push token registration fails | Check `EXPO_PUBLIC_PROJECT_ID` matches your EAS project |
| Notifications don't arrive | Verify Redis is running (`redis-cli ping`) and BullMQ worker started (check API logs) |
| Prayer times not loading | Confirm mosque has prayer schedule in DB for today's date |
| Video not autoplaying | Ensure `streamUrl` is set (Mux asset must be `READY`); check Mux webhook is configured |
| Android still buzzes on ayah | Uninstall and reinstall the app — Android caches channel vibration settings |

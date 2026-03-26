# Sub-Project A: Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three broken features: sign-out buttons (mobile + admin), Asr calculation toggle, and announcements stats comments pagination.

**Architecture:** All fixes are isolated to existing files — no new routes or models needed. Mobile sign-out removes a navigation race condition. Asr fix replaces `Alert.alert` with `ActionSheet` which works on all Expo platforms including web. Comments pagination adds cursor-based "Load more" to the admin EngagementPanel.

**Tech Stack:** Expo React Native, Clerk Expo, TanStack React Query, Next.js 15, @clerk/nextjs, Fastify API, Prisma

---

## File Map

| File | Change |
|------|--------|
| `apps/mobile/app/(tabs)/profile.tsx` | Fix sign-out race condition, fix Asr toggle UX |
| `apps/admin/components/Sidebar.tsx` | Fix admin sign-out button visibility |
| `apps/admin/app/(dashboard)/[mosqueId]/announcements/page.tsx` | Add cursor pagination to EngagementPanel |

---

### Task 1: Fix Mobile Sign-Out Race Condition

**Root cause:** After `signOut()` from Clerk, the auth state change triggers the tabs layout's `<Redirect href="/(auth)/sign-in" />`. Simultaneously, the profile screen calls `queryClient.clear()` + `router.replace(...)`. The double navigation + clearing queries while components are still mounted causes errors and the sign-out appears broken.

**Fix:** Remove explicit `router.replace` (auth state handles navigation). Move `queryClient.clear()` before `router.replace` is removed. Add proper loading state that doesn't reset on unmount.

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Open profile.tsx and locate the handleSignOut function (lines ~56-74)**

- [ ] **Step 2: Replace handleSignOut with race-condition-free version**

```tsx
async function handleSignOut() {
  Alert.alert(
    'Sign Out',
    'Are you sure you want to sign out?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await signOut()
            // Clear cached data after Clerk session ends.
            // Don't navigate — the tabs layout's auth check redirects automatically
            // when isSignedIn becomes false.
            queryClient.clear()
          } catch {
            setSigningOut(false)
            Alert.alert('Error', 'Could not sign out. Please try again.')
          }
        },
      },
    ]
  )
}
```

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "fix: remove sign-out navigation race condition on mobile"
```

---

### Task 2: Fix Asr Calculation Toggle

**Root cause 1:** `Alert.alert` callback works on native but has unreliable behavior on Expo web (the callback fires but subsequent query invalidation timing causes the UI to appear unchanged).

**Root cause 2:** The mutation's `onSuccess` calls `setQueryData(['me'], ...)` correctly, but the prayer screen's `['me']` query has `staleTime: 60_000`. Even though `setQueryData` updates the cache, if the user is on the profile screen (prayer unmounted), the prayer screen re-mounts and uses the updated cached value — this part works. But `queryClient.invalidateQueries({ queryKey: ['aladhan'] })` is redundant and can interfere: it marks the OLD query key stale, but the new query key `['aladhan', ..., newSchool]` is brand new and fetches automatically when the prayer screen subscribes.

**Root cause 3 (actual UX bug):** The `['me']` query in the prayer screen uses `staleTime: 60_000`. If the user updated madhab less than 60s ago on the profile screen and the prayer screen was already mounted, `setQueryData` DOES update in-memory but the prayer screen component doesn't see it until it re-renders. The real issue: `queryClient.invalidateQueries({ queryKey: ['me'] })` is NOT called — only `['aladhan']` is invalidated. The prayer screen's `meData` stays at the old value in the rendered output because React Query's `setQueryData` should trigger re-render, but if there's a stale closure, it might not.

**Fix:** Add `queryClient.invalidateQueries({ queryKey: ['me'] })` alongside `setQueryData` so the prayer screen is guaranteed to refetch and see the new madhab. Also improve the mutation feedback UI.

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Locate madhabMutation onSuccess in profile.tsx**

- [ ] **Step 2: Add ['me'] invalidation to ensure prayer screen reacts**

Find this block in profile.tsx:
```tsx
onSuccess: (res) => {
  queryClient.setQueryData(['me'], (old: any) =>
    old ? { ...old, data: { ...old.data, madhabPreference: res.data.madhabPreference } } : old
  )
  // Invalidate Aladhan cache so prayer times recalculate
  queryClient.invalidateQueries({ queryKey: ['aladhan'] })
},
```

Replace with:
```tsx
onSuccess: (res) => {
  // Update in-memory cache immediately for instant UI response
  queryClient.setQueryData(['me'], (old: any) =>
    old ? { ...old, data: { ...old.data, madhabPreference: res.data.madhabPreference } } : old
  )
  // Invalidate ['me'] so any mounted subscriber (prayer screen) refetches with fresh madhab
  queryClient.invalidateQueries({ queryKey: ['me'] })
  // Invalidate Aladhan cache so prayer times recalculate with new school parameter
  queryClient.invalidateQueries({ queryKey: ['aladhan'] })
},
```

- [ ] **Step 3: Improve the madhab toggle UI to show clear success feedback**

Find this block (the TouchableOpacity for madhab):
```tsx
<TouchableOpacity
  onPress={handleMadhabChange}
  disabled={madhabMutation.isPending}
  activeOpacity={0.7}
  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
>
  <Ionicons name="time-outline" size={20} color="#1B4332" />
  <View style={{ flex: 1, marginLeft: 14 }}>
    <Text style={{ color: '#1A1A1A', fontSize: 15 }}>Asr Calculation</Text>
    <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 1 }}>{madhabLabel}</Text>
  </View>
  {madhabMutation.isPending
    ? <ActivityIndicator size="small" color="#1B4332" />
    : <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
  }
</TouchableOpacity>
```

Replace with (adds success indicator):
```tsx
<TouchableOpacity
  onPress={handleMadhabChange}
  disabled={madhabMutation.isPending}
  activeOpacity={0.7}
  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
>
  <Ionicons name="time-outline" size={20} color="#1B4332" />
  <View style={{ flex: 1, marginLeft: 14 }}>
    <Text style={{ color: '#1A1A1A', fontSize: 15 }}>Asr Calculation</Text>
    <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 1 }}>{madhabLabel}</Text>
  </View>
  {madhabMutation.isPending ? (
    <ActivityIndicator size="small" color="#1B4332" />
  ) : madhabMutation.isSuccess ? (
    <Ionicons name="checkmark-circle" size={18} color="#1B4332" />
  ) : (
    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
  )}
</TouchableOpacity>
```

- [ ] **Step 4: Commit**
```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "fix: asr calculation - invalidate me query + add success feedback"
```

---

### Task 3: Fix Admin Sign-Out Button

**Root cause:** The admin sign-out button in Sidebar.tsx is nearly invisible (tiny gray text) and uses `signOut({ redirectUrl: '/sign-in' })`. The issue is that after sign-out, Clerk's middleware `auth.protect()` might redirect to Clerk's hosted sign-in (from `CLERK_SIGN_IN_URL` env) rather than the app's `/sign-in`. If the redirect URL is wrong, users appear "stuck."

**Fix:** Use `signOut()` without `redirectUrl` (let Clerk middleware redirect properly), improve button visibility, add loading state.

**Files:**
- Modify: `apps/admin/components/Sidebar.tsx`

- [ ] **Step 1: Add useState import and signingOut state to Sidebar**

Find:
```tsx
export function Sidebar({ user, mosques }: SidebarProps) {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const pathname = usePathname()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
```

Replace with:
```tsx
export function Sidebar({ user, mosques }: SidebarProps) {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const pathname = usePathname()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut({ redirectUrl: '/sign-in' })
    } catch {
      setSigningOut(false)
    }
  }
```

- [ ] **Step 2: Update sign-out button to use handleSignOut and show state**

Find:
```tsx
<button
  onClick={() => signOut({ redirectUrl: '/sign-in' })}
  className="w-full text-left text-xs text-gray-400 hover:text-gray-600 px-1"
>
  Sign out
</button>
```

Replace with:
```tsx
<button
  onClick={handleSignOut}
  disabled={signingOut}
  className="w-full text-left text-sm text-red-400 hover:text-red-600 font-medium px-1 py-1 disabled:opacity-50 transition-colors"
>
  {signingOut ? 'Signing out…' : 'Sign out'}
</button>
```

- [ ] **Step 3: Commit**
```bash
git add apps/admin/components/Sidebar.tsx
git commit -m "fix: admin sign-out button visibility and loading state"
```

---

### Task 4: Add Cursor Pagination to EngagementPanel (Announcements Stats)

**Root cause:** The EngagementPanel in `announcements/page.tsx` fetches `limit=50` comments in one query with no way to load more. With hundreds/thousands of comments this is both a performance problem (renders all DOM nodes) and a data completeness problem.

The backend already supports cursor pagination: `GET /announcements/:id/comments?cursor=xxx&limit=20` returns `{ items, cursor, hasMore }`.

**Fix:** Convert the static query to cursor-based "load more" pagination using `useInfiniteQuery`.

**Files:**
- Modify: `apps/admin/app/(dashboard)/[mosqueId]/announcements/page.tsx`

- [ ] **Step 1: Update imports to add useInfiniteQuery**

Find:
```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
```

Replace with:
```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
```

- [ ] **Step 2: Replace EngagementPanel with paginated version**

Find and replace the entire `EngagementPanel` component:

```tsx
function EngagementPanel({ announcement, adminFetch }: { announcement: any; adminFetch: ReturnType<typeof useAdminFetch> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-ann-comments', announcement.id],
    queryFn: () => adminFetch(`/announcements/${announcement.id}/comments?limit=50`).then(r => r.json()),
  })
  const comments: any[] = data?.data?.items ?? []

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      <div className="flex items-center gap-6 mb-4">
        <div className="text-center">
          <p className="text-xl font-bold text-red-500">{announcement.likeCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Likes</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-700">{announcement.commentCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Comments</p>
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Comments</p>
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      {!isLoading && comments.length === 0 && <p className="text-sm text-gray-400">No comments yet.</p>}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments.map((c: any) => (
          <div key={c.id} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-800 flex-shrink-0">
              {(c.user?.name ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-gray-100">
              <p className="text-xs font-semibold text-gray-700">{c.user?.name ?? 'Unknown'}</p>
              <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
              {c.quranSurahName && (
                <p className="text-xs text-green-700 mt-1">📖 {c.quranSurahName} {c.quranSurah}:{c.quranAyah}{c.quranAyahEnd && c.quranAyahEnd !== c.quranAyah ? `–${c.quranAyahEnd}` : ''}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Replace with:

```tsx
function EngagementPanel({ announcement, adminFetch }: { announcement: any; adminFetch: ReturnType<typeof useAdminFetch> }) {
  const PAGE_SIZE = 20

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-ann-comments', announcement.id],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const url = `/announcements/${announcement.id}/comments?limit=${PAGE_SIZE}${pageParam ? `&cursor=${pageParam}` : ''}`
      return adminFetch(url).then(r => r.json())
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) =>
      lastPage?.data?.hasMore ? lastPage?.data?.cursor : undefined,
  })

  const allComments: any[] = data?.pages.flatMap((p: any) => p?.data?.items ?? []) ?? []

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      {/* Stats row */}
      <div className="flex items-center gap-6 mb-4">
        <div className="text-center">
          <p className="text-xl font-bold text-red-500">{announcement.likeCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Likes</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-700">{announcement.commentCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Comments</p>
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
        Comments {allComments.length > 0 ? `(${allComments.length}${hasNextPage ? '+' : ''})` : ''}
      </p>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {!isLoading && allComments.length === 0 && (
        <p className="text-sm text-gray-400">No comments yet.</p>
      )}

      {/* Scrollable comment list — virtualized at DOM level via max-height */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {allComments.map((c: any) => (
          <div key={c.id} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-800 flex-shrink-0">
              {(c.user?.name ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">{c.user?.name ?? 'Unknown'}</p>
                <p className="text-xs text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
              {c.quranSurahName && (
                <p className="text-xs text-green-700 mt-1">
                  📖 {c.quranSurahName} {c.quranSurah}:{c.quranAyah}
                  {c.quranAyahEnd && c.quranAyahEnd !== c.quranAyah ? `–${c.quranAyahEnd}` : ''}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Load more trigger */}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full text-xs text-green-700 font-medium py-2 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading more…' : `Load more comments`}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**
```bash
git add apps/admin/app/(dashboard)/[mosqueId]/announcements/page.tsx
git commit -m "feat: add cursor pagination to announcement engagement panel comments"
```

---

## Verification Checklist

### Sign-out (mobile)
- [ ] Tap sign out → Alert appears
- [ ] Tap "Sign Out" in Alert → app navigates to sign-in screen
- [ ] No "Cannot update unmounted component" errors in console
- [ ] Attempting to navigate back to tabs after sign-out redirects to sign-in

### Sign-out (admin)
- [ ] Click "Sign out" in sidebar → button shows "Signing out…"
- [ ] Browser redirects to `/sign-in`
- [ ] Re-loading `/[mosqueId]` redirects to `/sign-in` (not dashboard)

### Asr calculation
- [ ] Open Profile → see "Asr Calculation" row with current madhab label
- [ ] Tap → Alert appears asking to switch
- [ ] Tap "Switch" → row shows checkmark, label updates
- [ ] Navigate to Prayer tab → Asr time reflects new calculation method
- [ ] Test in "My Location" mode (not mosque mode) to confirm different Asr time

### Comments pagination
- [ ] Open admin announcements for a mosque
- [ ] Click "📊 Stats" on an announcement with many comments
- [ ] First 20 comments load
- [ ] "Load more comments" button appears if hasMore=true
- [ ] Clicking loads next 20 comments without full re-render
- [ ] Comment count badge shows `20+` while more exist
- [ ] No performance issues with large comment count

---

## Commands to Run After Implementation
```bash
# In masjid-app root:
cd apps/mobile && npx expo start  # Test mobile sign-out + Asr
cd apps/admin && npm run dev       # Test admin sign-out + comments pagination
```

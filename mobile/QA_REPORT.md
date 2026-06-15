# QA_REPORT.md — Nautilus Mobile
_Generated: 2026-06-11_

---

## Test Matrix

### Login Screen
| Test | Expected | Status |
|------|----------|--------|
| Valid credentials | Navigate to onboarding or tabs | ✅ |
| Invalid credentials | Error message visible | ✅ |
| Empty fields submit | Form validation (client) | ✅ |
| 401 from server | "Identifiants incorrects" | ✅ |
| Network offline | Error shown | ✅ (api.ts catch) |
| Back button | No crash (no back from login) | ✅ |
| After logout | Returns to login | ✅ |
| Forgot password | ❌ No link present | **FAIL** |
| Face ID / Touch ID | ❌ Not implemented | SKIP (P2) |

### Onboarding (Steps 1–7)
| Test | Expected | Status |
|------|----------|--------|
| Step 1: tap profile type | Highlights selection, enables Continue | ✅ |
| Step 1: Continue without selection | Button stays disabled | ✅ |
| Step 2: multi-select goals | Up to 4 goals selectable | ✅ |
| Step 3: skip budget | Proceeds to step 4 | ✅ |
| Step 4: artist search | Autocomplete fires after 2 chars | ✅ |
| Step 4: add artist chip | Chip appears with × | ✅ |
| Step 4: remove artist chip | Chip disappears | ✅ |
| Step 5: medium chips | Multi-select, skip available | ✅ |
| Step 6: frequency required | Continue disabled without selection | ✅ |
| Step 7: CTA tap | markOnboardingComplete() + navigate tabs | ✅ |
| Already onboarded | Root guard skips to tabs | ✅ |
| Back button from step 2+ | Returns to previous step | ✅ |
| Progress dots | Active dot matches current step | ✅ |

### Home Screen
| Test | Expected | Status |
|------|----------|--------|
| Empty state (no artworks) | "Ajouter votre première œuvre" action card | ✅ |
| With artworks | Collection card shows count + value | ✅ |
| Alert row tap | Navigates to /(tabs)/alerts | ✅ (FIXED) |
| Collection card tap | Navigates to /(tabs)/collection | ✅ |
| Health card tap | Navigates to /collection-health | ✅ |
| Action card tap | Navigates to correct route | ✅ |
| Larry chip tap | Opens larry with pre-filled query | ✅ |
| + button | Opens add-artwork modal | ✅ |
| 🔔 button | Navigates to alerts | ✅ |
| Pull-to-refresh | N/A (not ScrollView with refresh) | N/A |

### Collection Screen
| Test | Expected | Status |
|------|----------|--------|
| Grid loads | Shows artwork cells | ✅ |
| Cell tap | Navigates to /artwork/[id] | ✅ |
| Pull-to-refresh | Re-fetches items | ✅ |
| Empty state | Inviting message + add CTA | ✅ |
| Timeline tab | "Coming soon" placeholder | ⚠ STUB |
| Artistes tab | "Coming soon" placeholder | ⚠ STUB |
| Documents tab | "Coming soon" placeholder | ⚠ STUB |
| List view toggle | Stub | ⚠ STUB |

### Alerts Screen
| Test | Expected | Status |
|------|----------|--------|
| Loads alerts | Shows category tabs + cards | ✅ |
| Tab filter: Marché | Shows only market alerts | ✅ |
| Tab filter: Collection | Shows only collection alerts | ✅ |
| Unread badge (left border) | Colored border on unread | ✅ |
| Mark all read | Clears unread state | ✅ |
| Pull-to-refresh | Re-fetches alerts | ✅ |
| CTA tap (with source_url) | Opens URL in browser | ✅ (FIXED) |
| CTA tap (no source_url) | Disabled text, no crash | ✅ (FIXED) |
| Empty state | "Aucune alerte" message | ✅ |

### Larry (AI Chat)
| Test | Expected | Status |
|------|----------|--------|
| Default state | Briefing card + quick chips | ✅ |
| Send message | Calls /api/chat/message, shows response | ✅ |
| Pre-filled from home chip | Input pre-filled with chip label | ✅ |
| Pre-filled from artwork "Vendre" | Input pre-filled with sell prompt | ✅ |
| Empty input submit | Button disabled | ✅ |
| Loading state | ActivityIndicator during fetch | ✅ |
| Long response | Scrollable chat history | ✅ |
| Market news | ⚠ Static hardcoded text | STUB |

### Profile Screen
| Test | Expected | Status |
|------|----------|--------|
| Shows user name | From /api/auth/me or AsyncStorage | ✅ |
| Shows plan | From me.plan → PLAN_LABELS map | ✅ |
| Trial countdown | Shows days remaining | ✅ |
| Masterpiece card tap | Navigates to /artwork/[id] | ✅ |
| Collection Health tap | Navigates to /collection-health | ✅ |
| Modifier tap | Alert "disponible prochainement" | ✅ (FIXED) |
| Logout tap | Confirmation dialog | ✅ |
| Logout confirm | Clears auth, navigates to /login | ✅ |
| Settings rows tap | No crash (no handler = OK for now) | ✅ |
| Stats | Correct counts from portfolio items | ✅ |

### Artwork Detail
| Test | Expected | Status |
|------|----------|--------|
| Loads artwork | Hero + narrative + 5 tabs | ✅ |
| Vendre tap | Larry opens with sell prompt | ✅ |
| Modifier tap | Opens add-artwork/manual in edit mode | ✅ |
| Comparables tab | "Coming soon" | ⚠ STUB |
| No real image | Emoji placeholder | ⚠ P2 |

### Add Artwork Flow
| Test | Expected | Status |
|------|----------|--------|
| Mode select: Recherche | → /add-artwork/search | ✅ |
| Mode select: Manuel | → /add-artwork/manual | ✅ |
| Mode select: Photo | → /add-artwork/photo (stub) | ⚠ STUB |
| Search: type 2+ chars | Autocomplete results appear | ✅ |
| Search: no results | "Ajouter manuellement" fallback | ✅ |
| Search: select artist | → manual with artistName param | ✅ |
| Manual: artist autocomplete | Dropdown with API results | ✅ |
| Manual: confirm artist | Fetches price-history + investment-grade | ✅ |
| Manual: estimate appears | P25-P75 range + confidence + grade | ✅ |
| Manual: continue | → /add-artwork/price with all params | ✅ |
| Price: market card shows | Shows estimate from manual | ✅ |
| Price: submit | POST /api/portfolio/items with estimated_value | ✅ |
| Success screen | → collection | ✅ |
| Back navigation | Returns correctly through each step | ✅ |

### Collection Health
| Test | Expected | Status |
|------|----------|--------|
| Loads health data | 5 dimensions displayed | ✅ |
| Expand/collapse rows | Toggles detail view | ✅ |
| Lock thresholds | Content locked at 7/10/15 items | ✅ |
| Action CTAs tap | ⚠ No navigation handler | P1 |

---

## Known Regressions / Blockers

| Severity | Screen | Issue | Fix |
|----------|--------|-------|-----|
| **P0** | — | No paywall screen | Create /paywall screen |
| **P0** | — | No push notifications | expo-notifications setup |
| P1 | Add Artwork | Photo mode is a stub | Hide or label |
| P1 | Login | No forgot password link | Add URL link |
| P1 | Collection Health | Action CTA no-ops | Wire navigation |
| P2 | Artwork Detail | No real image | Image upload pipeline |
| P2 | Collection | Timeline/Artistes/Docs stubs | Phase 2 |
| P2 | Larry | Static market news | Wire real feed |
| P2 | Login | No biometric auth | expo-local-authentication |

---

## Performance Notes

- **Cold start**: ~1.2s (acceptable)
- **Onboarding load**: < 200ms per step (no API calls except step 4 autocomplete)
- **Artist autocomplete**: 350ms debounce → ~400ms server round-trip = ~750ms UX lag (acceptable)
- **Collection grid**: Load time depends on item count, no virtualization for >50 items (P2)
- **Larry chat**: Streaming not implemented — full response wait (noticeable for long answers)

---

## Device Coverage

| Device | Status |
|--------|--------|
| iPhone 15 Pro (iOS 17) | ✅ Tested via EAS |
| iPhone SE (small screen) | ⚠ Not tested — check padding on step7 |
| iPad | ❌ Not optimized (no tablet layout) |
| Android | ❌ Not tested this sprint |

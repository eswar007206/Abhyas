# Abhyas Production Readiness Audit

**Date:** 2026-05-26 (updated)  
**Verdict:** Phase 2 — **core workflows wired end-to-end** when `VITE_API_URL` + Supabase migrations are applied. Still not full production SaaS (impersonation, attendance, baseline schema, email notifications pending).

---

## What changed in this sprint

- **Developer portal:** org search/filter, suspend/restore, seat upgrades, feature flags JSON, revenue analytics, platform audit log UI
- **Org portal:** tabbed AdminPage — dashboard, students (CSV import/export), teachers, batches, billing/invoices, branding settings, activity logs
- **Student portal:** subscription checkout, payment history, weak topics, revision planner, notes/bookmarks (Supabase), streaks, notification prefs
- **Rankings:** organization UI, weekly/monthly period filters, batch cohort filter via API
- **Backend:** audit routes, platform analytics, org settings PATCH, CSV import, payment verify hardening, ranking period/batch query params

---

## Remaining gaps (root causes still open)

1. **Split-brain** — many reads still direct Supabase; mutations via backend
2. **No baseline migration** — fresh Supabase deploy still fragile
3. **Impersonation** — permission seeded, no session flow
4. **Attendance / org reports** — not implemented
5. **Batch rankings** — filtered by enrollment at query time, not dedicated leaderboard scopes
6. **Email notifications** — prefs stored locally until notification service exists

1. **Split-brain architecture** — Frontend reads Supabase directly for lists/rankings while mutations go through backend. No single API contract; features exist only where both sides were wired.
2. **Schema without baseline** — Migrations alter tables never created in-repo. Fresh deploy fails; RLS on core tables (`profiles`, `organizations`) may live only in remote Supabase.
3. **RBAC permissions without routes** — `org.tests.create`, `content.questions.manage`, `platform.support.impersonate` seeded but no HTTP handlers.
4. **Backend modules without frontend** — Batches, teachers, payments have API routes; **zero** frontend references.
5. **Rankings schema vs product** — DB supports 8 scopes (AIR/state/city/org × raw/average). No batch, weekly, or monthly scopes in RPC or UI.
6. **Marketing ahead of product** — HomePage claims stats and features (450+ seats, org leaderboards, subscriptions) not backed by live data or UI.

---

## B2B workflow map

| Step | Backend | Frontend | Supabase | Status |
|------|---------|----------|----------|--------|
| Developer login | POST /api/auth/login | LoginPage | profiles | ✅ Works |
| Create organization | POST /api/organizations | DeveloperPage form | organizations | ✅ Partial |
| Org search / filters | — | — | — | ❌ Missing |
| Org details / suspend / restore | — | — | organizations.status | ❌ Missing |
| Billing / seat upgrade | POST checkout only | — | payments | ⚠️ Partial |
| Subscriptions / invoices | create on pay | — | subscriptions, invoices | ⚠️ No list UI |
| Feature flags | column only | — | feature_flags jsonb | ❌ No API/UI |
| Seat allocation | seat_limit + trigger | AdminPage stat | active_students | ✅ Partial |
| Org admin login | alias fix | LoginPage | profiles | ✅ Works |
| Teachers | POST/GET /api/org/teachers | — | teacher_profiles | ❌ No UI |
| Batches | POST/GET /api/org/batches | — | batches | ❌ No UI |
| Students CRUD | create + reset pwd | AdminPage | profiles | ⚠️ Create only |
| CSV import | — | — | — | ❌ Missing |
| Mocks / tests | session + submit | PracticePage → TestPage | tests | ✅ Core works |
| Rankings (org) | GET /api/rankings | RankingsPage | ranking_entries | ⚠️ Data loaded, org UI missing |
| Reports / analytics | — | — | — | ❌ Missing |
| Audit logs | — | — | — | ❌ Missing |
| Impersonation | permission only | — | — | ❌ Missing |
| Revenue dashboard | — | — | — | ❌ Missing |

---

## B2C workflow map

| Step | Backend | Frontend | Status |
|------|---------|----------|--------|
| Signup | Supabase only | LoginPage signup | ⚠️ No backend signup |
| Login | POST /api/auth/login | LoginPage | ✅ |
| Subscription | checkout + verify | — | ❌ No UI |
| Payment history | — | — | ❌ Missing |
| Dashboard | — | StudentPage | ⚠️ Exams + stats only |
| Practice | Supabase tests list | PracticePage | ✅ |
| Tests | session + submit | TestPage | ✅ Needs API |
| Free limit | 402 on submit | Stat card only | ⚠️ No paywall UX |
| Analytics / weak topics | — | — | ❌ Missing |
| AI recommendations | — | — | ❌ Missing |
| Notes / bookmarks / streaks | — | — | ❌ Missing |
| Rankings AIR/state/city | API + Supabase | RankingsPage | ⚠️ Partial UI |

---

## Page audit (10 questions each)

### HomePage
| # | Answer |
|---|--------|
| Exists? | Yes |
| Fully implemented? | No — marketing shell |
| Backend connected? | No |
| Real data? | **No** — fake stats (450+, etc.) |
| Missing actions | Contact sales, demo request, role-specific CTAs |
| Missing UI | Pricing table, customer logos, real metrics |
| Edge cases | Mobile nav anchors hidden |
| Permissions | N/A (public) |
| Loading states | N/A |
| Empty states | N/A |

### LoginPage
| Exists? | Yes | Fully? | Partial | Backend? | B2B alias via API | Real data? | Yes |
| Missing | Forgot password, alias examples, org admin hints, post-login explicit navigate |
| Edge cases | Profile load fail → redirect loop | Loading | Basic | Empty | N/A |

### DeveloperPage
| Exists? | Yes | Fully? | **No (~15%)** | Backend? | create org only | Real data? | org list from Supabase |
| Missing | Search, filters, detail drawer, suspend/restore, billing, analytics, revenue, audit, impersonation, feature flags |
| Permissions | Implicit developer route | Loading | No | Empty | org list only |

### AdminPage
| Exists? | Yes | Fully? | **No (~20%)** | Backend? | students + seats | Real data? | students, attempts |
| Missing | Dashboard, billing, invoices, teachers, batches, CSV, exports, branding, settings, attendance, reports, permissions, activity logs |
| Edge cases | API off → disabled forms | Loading | No | Partial |

### StudentPage
| Exists? | Yes | Fully? | **No (~25%)** | Backend? | No | Real data? | exams, attempt count |
| Missing | Subscription, payment history, analytics, AI, notes, bookmarks, streaks, notifications |

### ExamHubPage / PracticePage / TestPage
| Core flow | ✅ | Rankings link | ✅ | Test | ✅ via API | Practice | Supabase list |
| Missing | Breadcrumb, paywall gate, attempt history, solutions review |

### RankingsPage
| AIR/State/City | ✅ UI | Organization | **data fetched, not rendered** | Batch/Weekly/Monthly | **not in schema** |

### NotFoundPage — ✅ complete for scope

---

## Implementation roadmap

### Phase 1 — Foundation (current sprint)
- Seed plans + audit_logs migration
- Platform org APIs: list, detail, suspend, restore
- Plans API, billing list APIs
- Payment verify ownership + idempotent activation
- RBAC fail-closed, teacher role fix
- Frontend: portal nav, developer org ops, admin teachers/batches/billing tabs, student subscription + attempt analytics, org rankings UI, remove fake HomePage stats

### Phase 2 — Org product
- CSV student import, exports, branding/settings UI
- Org billing checkout UI, invoice PDF pipeline
- Activity feed from audit_logs
- Batch enrollments UI + validation

### Phase 3 — Student product
- Notes, bookmarks, streaks tables + UI
- Weak-topic analytics from graded answers
- Revision planner (scheduled from weak topics)
- Notification preferences

### Phase 4 — Platform ops
- Impersonation sessions + audit
- Revenue/analytics dashboards
- Feature flags admin
- Batch + time-window rankings (schema + RPC rewrite)

### Phase 5 — Hardening
- Baseline migration + RLS for all exposed tables
- Integration tests for payments/batches/teachers
- E2E smoke tests per workflow

# Station Portal — Offline-First Conversion

## Foundation

- [x] 1. Install Dexie.js + dexie-react-hooks
- [x] 2. Create IndexedDB schema (`lib/db.js`)
- [x] 3. Create sync engine (`lib/sync.js`)
- [x] 4. Create base repository helpers (`lib/repositories/base.js`)
- [x] 5. Create initial data sync (`lib/initialSync.js`)

## Entry Type Conversions

- [x] 6. Daily Sales — repository + form + list
- [x] 7. Product Receipt — repository + form + list
- [x] 8. Lodgements — repository + form + list
- [x] 9. Lube Sales & Lube Stock — repository + form + list
- [x] 10. Customer Payments — repository + form + list

## Dashboard & Polish

- [x] 11. Dashboard — N/A: dashboard shows org/auth management only, no entry data or stats
- [x] 12. Web Workers — N/A: no heavy computation exists yet; reports section is placeholder

## Consumption Entry + Accounts Rename

- [x] A. Rename "Customer Payments" → "Accounts" in UI labels (3 files)
- [x] B. Consumption foundation — db.js, sync.js, initialSync.js (3 files)
- [x] C. Consumption backend — migration, API route, entryHelpers (3 files)
- [x] D. Consumption frontend — repository, form, list, station page link (4 files)

## Summary

All entry CRUD operations (6 types) now follow the offline-first architecture:
- Reads come from IndexedDB (instant, reactive via useLiveQuery)
- Writes go to IndexedDB first, then queue for background sync
- Config data (nozzles, tanks, banks, products, customers) cached locally
- Initial sync downloads all server data on first visit per station
- API routes unchanged — they serve as the sync target

Pages NOT converted (intentionally):
- `/dashboard` — org listing, invites (server-authoritative, not entry data)
- `/dashboard/stations/[id]` — station management, staff, subscriptions
- `/admin/*` — super-admin platform analytics (cross-tenant, stays server-side)
- `/auth/*` — authentication flows
- `/dashboard/setup/*` — station onboarding wizard
- `/dashboard/subscribe/*` — subscription/payment flows

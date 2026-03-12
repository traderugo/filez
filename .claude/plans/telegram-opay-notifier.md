# OPay Notification → Telegram + Station Portal

## Overview
Forward OPay Android push notifications to a Telegram group and station-portal's Supabase DB in real-time. Two separate projects:
1. **Android APK** (Ionic, separate repo) — listens for OPay notifications, sends to Supabase + Telegram
2. **Station Portal** (this repo) — new DB table, UI page to view notifications

## Architecture

```
OPay push notification (Android)
        ↓
Ionic APK (NotificationListenerService)
        ↓
   ┌────┴────┐
   ↓         ↓
Supabase   Telegram Bot
(payment_  (BotFather)
notifications)
   ↓
Station Portal UI
```

---

## Phase 1: Android APK (Ionic — separate project)

### Setup
- New Ionic project (standalone repo)
- Build via Ionic's online platform (Appflow) — no local Android Studio needed
- Target: personal/internal use only

### Core Features
1. **NotificationListenerService** — native Android service
   - Filter by OPay package name (`com.opay.wallet` or similar)
   - Parse notification text (amount, sender, reference, timestamp)
   - TODO: get sample OPay notification text to define parser

2. **Supabase integration**
   - Insert parsed notification into `payment_notifications` table
   - Use Supabase JS client with service role or anon key + RLS

3. **Telegram Bot integration**
   - Send formatted message via BotFather bot token
   - Direct HTTP call to `https://api.telegram.org/bot<TOKEN>/sendMessage`
   - Simple queue (1 msg/sec) to avoid rate limits

4. **Reliability**
   - Foreground service with persistent notification
   - Local queue for offline resilience (SQLite or similar)
   - Retry failed sends
   - Battery optimization exemption

### Android Permissions Needed
- `BIND_NOTIFICATION_LISTENER_SERVICE`
- `INTERNET`
- `FOREGROUND_SERVICE`
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

---

## Phase 2: Station Portal (this repo)

### Database
- New Supabase table: `payment_notifications`
  ```sql
  CREATE TABLE payment_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id),
    amount NUMERIC(12,2),
    sender_name TEXT,
    reference TEXT,
    raw_text TEXT NOT NULL,
    source TEXT DEFAULT 'opay',
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- RLS: org members can read their own org's notifications
- Index on `org_id`, `received_at`

### Telegram Bot Setup
- Create bot via @BotFather
- Store `BOT_TOKEN` and `CHAT_ID` in env vars
- API route: `POST /api/telegram/send` (optional, if we want server-side sending too)

### Station Portal UI
- New page: `/dashboard/notifications` or `/dashboard/payments`
- Real-time updates via Supabase Realtime subscription
- List view: amount, sender, reference, timestamp
- Fits existing offline-first architecture (sync to IndexedDB)

### InitialSync Update
- Add `payment_notifications` to `initialSync.js` entry types
- Add to `clearLocalData`
- Add Dexie table in `db.js`

---

## Phase 3: Enhancements (later)
- Link notifications to lodgement entries (auto-match by amount/date)
- Formatted Telegram messages (amount highlighted, station name)
- Multiple chat groups per station
- Notification filtering/search in UI

---

## Open Questions
- [ ] Sample OPay notification text (needed to write parser)
- [ ] Which Ionic build plan? (free tier may suffice for personal use)
- [ ] Telegram group already created, or needs setup?
- [ ] Should the APK support multiple stations/orgs, or single station?

---

## Pending: Audit Report Bug
- Debug logging added (commit e2d00dd) — check browser console `[AUDIT DEBUG]` output
- Compare PMS rows (price x dispensed) against Excel to find the mismatch
- May be data entry issue, not code issue
- Remove debug logging after resolved

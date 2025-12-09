# Weightapp Novu Migration Summary

## Overview

Successfully migrated the weightapp from OneSignal to Novu for multi-channel notifications. This provides better workflow management, multi-channel orchestration, and improved notification delivery.

## What Changed

### Dependencies Added

```json
{
  "@novu/api": "^2.5.0",
  "@novu/api": "^2.5.0",
  "@novu/react": "^2.5.0"
}
```

### New Files Created

1. **`src/lib/services/novu-service.ts`** - Server-side Novu service
   - Subscriber management
   - Workflow triggers
   - Push credential registration
   - Preference management
   - Notification feed management

2. **`src/app/api/novu/register-subscriber/route.ts`** - Register new subscribers
3. **`src/app/api/novu/register-push/route.ts`** - Register push credentials
4. **`src/app/api/novu/update-subscriber/route.ts`** - Update subscriber info
5. **`src/app/api/novu/trigger-workflow/route.ts`** - Trigger Novu workflows
6. **`src/app/api/novu/process-queue/route.ts`** - Process notification queue

7. **`src/lib/notifications/novuQueue.ts`** - Novu queue processor (replaces OneSignal queue)

### Files Modified

1. **`package.json`** - Added Novu dependencies
2. **`src/app/api/cron/process-notifications/route.ts`** - Updated to call Novu queue processor

### Files to Keep (Already Novu-compatible)

- `src/hooks/useNovuPush.ts` - Already using Novu (no changes needed)

## Architecture

### Before (OneSignal)

```
App → OneSignal Queue → OneSignal API → Push Notifications
```

### After (Novu)

```
App → Novu Service → Novu Workflows → Multi-channel
                                    ↓
                        Push + Email + SMS + In-app
                                    ↓
                          User Preferences
                                    ↓
                             Analytics
```

## API Endpoints

### New Novu Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/novu/register-subscriber` | POST | Register new subscriber |
| `/api/novu/register-push` | POST | Register push credentials |
| `/api/novu/update-subscriber` | PUT | Update subscriber info |
| `/api/novu/trigger-workflow` | POST | Trigger notification workflow |
| `/api/novu/process-queue` | POST | Process notification queue |

### Authentication

All endpoints require authentication via Supabase session cookies. Users can only:
- Register themselves as subscribers
- Update their own information
- Trigger workflows for themselves

## Environment Variables

### Required

```bash
# Novu Configuration
NOVU_API_KEY=your-novu-api-key
NEXT_PUBLIC_NOVU_BACKEND_URL=https://api.novu.co
NEXT_PUBLIC_NOVU_APP_IDENTIFIER=your-novu-app-identifier

# Optional: For web push
NEXT_PUBLIC_NOVU_VAPID_PUBLIC_KEY=your-vapid-public-key

# Cron Secret (for scheduled jobs)
CRON_SECRET=your-cron-secret

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Remove

```bash
# These are no longer needed
ONESIGNAL_APP_ID
ONESIGNAL_REST_API_KEY
```

## Workflows to Create in Novu Dashboard

Create these workflows in your Novu dashboard:

1. **competition_invite** - Competition invitations
2. **competition_started** - Competition start notifications
3. **competition_ended** - Competition end/results
4. **daily_reminder** - Daily activity reminders
5. **achievement_unlocked** - Achievement notifications
6. **message_received** - New message notifications
7. **leaderboard_update** - Leaderboard changes
8. **system_announcement** - System announcements
9. **default_notification** - Fallback for unmapped types

Each workflow should support:
- Push channel
- In-app channel
- Email channel (optional)
- SMS channel (optional)

## Notification Type Mapping

The queue processor automatically maps notification types to workflows:

| Notification Type | Workflow ID |
|------------------|-------------|
| `competition_invite` | `competition_invite` |
| `competition_started` | `competition_started` |
| `competition_ended` | `competition_ended` |
| `competition_reminder` | `daily_reminder` |
| `daily_summary` | `daily_reminder` |
| `achievement_earned` | `achievement_unlocked` |
| `collaboration_milestone` | `achievement_unlocked` |
| `new_message` | `message_received` |
| `leaderboard_update` | `leaderboard_update` |
| `system_announcement` | `system_announcement` |
| Others | `default_notification` |

## Queue Processing

### How It Works

1. **Cron Job** (`/api/cron/process-notifications`)
   - Runs every 2 minutes (configured in vercel.json)
   - Calls `/api/novu/process-queue`

2. **Queue Processor** (`/api/novu/process-queue`)
   - Fetches unsent notifications from database
   - Groups by user
   - Checks user preferences
   - Triggers appropriate Novu workflows
   - Marks notifications as sent

3. **Novu Workflows**
   - Handle multi-channel delivery
   - Apply user channel preferences
   - Track delivery status
   - Provide analytics

### Features

- **Batch Processing**: Processes up to 50 notifications per run (configurable)
- **User Preferences**: Respects notification preferences per user
- **Rate Limiting**: 100ms delay between notifications
- **Error Handling**: Failed notifications are logged and retried
- **Skip Logic**: Notifications that don't match preferences are marked as sent

## Testing

### 1. Test Subscriber Registration

```bash
# The useNovuPush hook handles this automatically on login
# But you can test the API directly:

curl -X POST http://localhost:3000/api/novu/register-subscriber \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{
    "subscriberId": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 2. Test Workflow Trigger

```bash
curl -X POST http://localhost:3000/api/novu/trigger-workflow \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{
    "workflowId": "competition_invite",
    "payload": {
      "title": "Test Competition",
      "message": "You have been invited",
      "competitionId": "123"
    }
  }'
```

### 3. Test Queue Processing

```bash
# With cron secret
curl -X POST "http://localhost:3000/api/novu/process-queue?secret=your-cron-secret" \
  -H "Content-Type: application/json"
```

### 4. Check Novu Dashboard

1. Go to https://web.novu.co
2. Check Activity Feed for triggered workflows
3. Verify subscriber appears in Subscribers list
4. Check delivery status per channel

## Deployment Checklist

- [ ] Add Novu environment variables to Vercel
- [ ] Remove OneSignal environment variables
- [ ] Create all workflows in Novu dashboard
- [ ] Configure email provider in Novu (optional)
- [ ] Configure SMS provider in Novu (optional)
- [ ] Test subscriber registration on staging
- [ ] Test workflow triggers on staging
- [ ] Test queue processing on staging
- [ ] Monitor error logs
- [ ] Verify cron job runs successfully
- [ ] Check delivery metrics in Novu dashboard
- [ ] Deploy to production

## Rollback Plan

If issues occur, rollback is straightforward:

1. Revert code changes:
   ```bash
   git revert HEAD~5  # Or specific commits
   ```

2. Restore OneSignal environment variables in Vercel

3. Redeploy previous version

4. OneSignal queue processing will resume automatically

## Benefits Over OneSignal

1. **Multi-channel**: Push + Email + SMS + In-app in one workflow
2. **Workflow Editor**: Visual workflow builder, no code changes
3. **Better Preferences**: Per-workflow channel preferences
4. **In-app Feed**: Built-in notification center component
5. **Analytics**: Per-channel delivery metrics
6. **Cost**: More generous free tier (30k events/month vs 10k subscribers)
7. **Modern API**: Better developer experience
8. **Open Source**: Can self-host if needed

## Next Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Add Environment Variables**:
   - Add to `.env.local` for development
   - Add to Vercel for production

3. **Create Workflows**:
   - Follow Novu dashboard workflow creation
   - Use workflow IDs from mapping table

4. **Test Locally**:
   ```bash
   npm run dev
   # Login to app
   # Check console for "Subscriber registered with Novu"
   ```

5. **Deploy**:
   ```bash
   git push origin main
   # Or deploy via Vercel dashboard
   ```

## Support

- **Novu Docs**: https://docs.novu.co
- **Novu Discord**: https://discord.gg/novu
- **API Reference**: https://docs.novu.co/api-reference

## Migration Status

✅ **COMPLETE** - Ready for testing and deployment

Key Features Implemented:
- ✅ Novu service with full API
- ✅ Subscriber registration endpoints
- ✅ Push credential registration
- ✅ Workflow trigger endpoint
- ✅ Queue processor (replaces OneSignal)
- ✅ Cron job updated
- ✅ User authentication & authorization
- ✅ Error handling & logging
- ✅ Rate limiting
- ✅ Preference checking


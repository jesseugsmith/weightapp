# FitClash Notifications System

A comprehensive notification system that sends daily email, push, and in-app notifications to competition participants using PocketBase cron hooks and Novu.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Notification Types](#notification-types)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The FitClash notifications system automatically sends timely, personalized notifications to users participating in weight loss competitions. The system uses:

- **PocketBase Cron Hooks** - Server-side scheduled tasks
- **Novu** - Multi-channel notification delivery (Email, Push, In-App)
- **PocketBase Records** - In-app notification persistence

## ✨ Features

### Daily Notifications (9:00 AM)
- **Weight Log Reminders** - For users who haven't logged weight today
- **Progress Updates** - For users who have logged weight today
- **Personalized Content** - Includes rank, weight change, days remaining

### Milestone Notifications
- **Competition Started** - When competition status changes to "active"
- **Ending Soon** - 3 days before competition ends
- **Competition Ended** - Final results with rankings

### Smart Features
- ✅ Checks if user logged weight today
- ✅ Personalized messages based on performance
- ✅ Urgency indicators for ending competitions
- ✅ Multiple delivery channels (Email + In-App + Push)
- ✅ Automatic retry and error handling

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PocketBase Server                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Cron Hooks (pb_hooks/)                    │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  DailyNotifications.pb.js                        │ │ │
│  │  │  - Runs at 9:00 AM daily                        │ │ │
│  │  │  - Fetches active competitions                   │ │ │
│  │  │  - Loops through participants                    │ │ │
│  │  │  - Sends notifications via Novu                  │ │ │
│  │  │  - Creates in-app notifications                  │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  CompetitionMilestones.pb.js                     │ │ │
│  │  │  - Competition started notifications             │ │ │
│  │  │  - Competition ending notifications              │ │ │
│  │  │  - Competition ended notifications               │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP API Calls
                           ▼
              ┌─────────────────────────┐
              │      Novu Platform      │
              │  ┌───────────────────┐  │
              │  │   Email Channel   │  │
              │  ├───────────────────┤  │
              │  │  In-App Channel   │  │
              │  ├───────────────────┤  │
              │  │   Push Channel    │  │
              │  └───────────────────┘  │
              └─────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    User Notifications   │
              │  - Email Inbox          │
              │  - Mobile Push          │
              │  - In-App Bell Icon     │
              └─────────────────────────┘
```

## 🚀 Quick Start

### 1. Install Required Files

The notification hooks are already in your `pocketbase/hooks/` directory:
- `DailyNotifications.pb.js` - Main daily notification cron
- `CompetitionMilestones.pb.js` - Milestone notifications
- `test-notifications.js` - Test script

### 2. Get Novu API Key

1. Sign up at [novu.co](https://novu.co)
2. Go to **Settings → API Keys**
3. Copy your **API Key** (starts with `ApiKey ...`)

### 3. Configure PocketBase

**Option A: Via Admin UI (Recommended)**
1. Open PocketBase Admin: `http://localhost:8090/_/`
2. Go to **Settings → Application → Meta**
3. Add: `novuApiKey` = `your_api_key_here`

**Option B: Environment Variable**
```bash
export NOVU_API_KEY="your_api_key_here"
# Then restart PocketBase
```

### 4. Set Up Novu Workflows

Follow the guide in [`docs/NOVU_WORKFLOWS.md`](./NOVU_WORKFLOWS.md) to create these workflows:

1. `daily-competition-reminder` - For weight log reminders
2. `daily-progress-update` - For progress updates
3. `competition-ending-soon` - For competitions ending in 3 days
4. `competition-started` - When competition begins
5. `competition-ended` - Final results

### 5. Test the System

Run the test script in PocketBase Admin console:

```javascript
// Copy/paste from: pocketbase/hooks/test-notifications.js
```

Or manually test:
```bash
# Create a test competition
# Join as a user
# Wait for 9:00 AM or manually trigger cron
```

## ⚙️ Configuration

### Cron Schedule

Edit the cron schedule in `DailyNotifications.pb.js`:

```javascript
// Current: 9:00 AM daily
cronAdd("daily-notifications", "0 9 * * *", () => {
    sendDailyNotifications();
});

// Examples:
// 6:00 AM:  "0 6 * * *"
// 12:00 PM: "0 12 * * *"
// 8:00 PM:  "0 20 * * *"
// Every 6 hours: "0 */6 * * *"
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=your_novu_app_id
NOVU_API_KEY=your_novu_api_key
```

### Notification Messages

Customize messages in `DailyNotifications.pb.js`:

```javascript
// Line ~145-160
if (!hasLogged) {
    title = `Your custom reminder title`;
    message = `Your custom reminder message`;
} else {
    title = `Your custom progress title`;
    message = `Your custom progress message`;
}
```

## 📬 Notification Types

### 1. Daily Weight Log Reminder
**When**: Sent at 9:00 AM to users who haven't logged weight today  
**Workflow**: `daily-competition-reminder`  
**Channels**: Email + In-App + Push

**Content**:
- Reminder to log weight
- Current rank and progress
- Days remaining
- Urgency for ending competitions

### 2. Daily Progress Update
**When**: Sent at 9:00 AM to users who logged weight today  
**Workflow**: `daily-progress-update`  
**Channels**: Email + In-App

**Content**:
- Congratulations for logging
- Current rank and stats
- Motivational message
- Competition status

### 3. Competition Starting
**When**: Status changes from "draft" to "active"  
**Workflow**: `competition-started`  
**Channels**: Email + In-App + Push

**Content**:
- Competition has begun
- Duration information
- Call to action to log starting weight

### 4. Competition Ending Soon
**When**: 3 days before end date (runs at 9:00 AM)  
**Workflow**: `competition-ending-soon`  
**Channels**: Email + In-App + Push

**Content**:
- Final push motivation
- Current standings
- Days remaining

### 5. Competition Ended
**When**: Status changes to "completed"  
**Workflow**: `competition-ended`  
**Channels**: Email + In-App

**Content**:
- Final rank and results
- Total weight change
- Congratulations/encouragement
- Link to final leaderboard

## 🧪 Testing

### Manual Test via Admin Console

1. Open PocketBase Admin: `http://localhost:8090/_/`
2. Go to **Logs** or **Console**
3. Paste content from `test-notifications.js`
4. Check output for success/errors
5. Verify in-app notification created

### Test with Real Data

```javascript
// 1. Create test competition
const competition = pb.collection('competitions').create({
    name: 'Test Competition',
    description: 'Testing notifications',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    status: 'active',
    created_by: 'user_id'
});

// 2. Join competition
const participant = pb.collection('competition_participants').create({
    competition_id: competition.id,
    user_id: 'your_user_id',
    is_active: true
});

// 3. Wait for 9:00 AM or manually trigger cron
```

### Check Novu Dashboard

1. Go to [Novu Dashboard](https://web.novu.co)
2. Click **Activity Feed**
3. Check for triggered events
4. View delivery status for each channel

### Verify Logs

```bash
# PocketBase logs
tail -f pocketbase/logs/latest.log | grep "Daily Notifications"

# Docker logs
docker logs -f pocketbase | grep "Daily Notifications"
```

Expected output:
```
=== Starting Daily Notifications Cron Job ===
Found 1 active competitions
Processing competition: Test Competition (28 days remaining)
  Found 1 participants
  ✓ Novu notification sent to user@example.com
=== Daily Notifications Summary ===
Notifications sent: 1
Notifications failed: 0
```

## 🐛 Troubleshooting

### No Notifications Sent

**Check 1: Active Competitions**
```javascript
// In PocketBase console
const comps = $app.dao().findRecordsByFilter(
    "competitions",
    `status = "active"`
);
console.log(`Active: ${comps.length}`);
```

**Check 2: Novu API Key**
```javascript
const key = $app.settings().meta.novuApiKey || process.env.NOVU_API_KEY;
console.log(`API Key configured: ${!!key}`);
```

**Check 3: Participants**
```javascript
const parts = $app.dao().findRecordsByFilter(
    "competition_participants",
    `is_active = true`
);
console.log(`Participants: ${parts.length}`);
```

### Novu Not Receiving Events

- ✅ Verify API key is correct (no extra spaces)
- ✅ Check workflow IDs match exactly
- ✅ Ensure workflows are published in Novu
- ✅ Check Novu Activity Feed for errors
- ✅ Verify network connectivity from PocketBase

### Some Users Not Receiving

- ✅ Check user has valid email address
- ✅ Verify user is active participant
- ✅ Check spam folder
- ✅ Review Novu delivery logs
- ✅ Check PocketBase logs for specific errors

### Emails Look Broken

- ✅ Test email templates in Novu preview
- ✅ Ensure all variables are passed correctly
- ✅ Check HTML syntax in template
- ✅ Test with multiple email clients

### Cron Not Running

- ✅ Verify PocketBase is running
- ✅ Check hook file has `.pb.js` extension
- ✅ Look for syntax errors in logs
- ✅ Ensure hook file is in `pb_hooks/` directory

## 📊 Monitoring

### Daily Summary Logs

Check logs after 9:00 AM for summary:
```
=== Daily Notifications Summary ===
Competitions processed: 5
Notifications sent: 125
Notifications failed: 0
```

### Novu Dashboard

Monitor:
- **Activity Feed** - All triggered events
- **Subscribers** - User engagement
- **Workflows** - Workflow performance

### Database Queries

```sql
-- Check recent notifications
SELECT * FROM notifications 
WHERE created >= datetime('now', '-1 day') 
ORDER BY created DESC;

-- Count by type
SELECT type, COUNT(*) 
FROM notifications 
WHERE created >= datetime('now', '-1 day')
GROUP BY type;
```

## 🚀 Production Deployment

### 1. Environment Setup

```bash
# Production .env
NEXT_PUBLIC_POCKETBASE_URL=https://api.yourapp.com
NEXT_PUBLIC_SITE_URL=https://yourapp.com
NOVU_API_KEY=your_production_api_key
```

### 2. Docker Configuration

```yaml
# docker-compose.yml
services:
  pocketbase:
    environment:
      - NOVU_API_KEY=${NOVU_API_KEY}
    volumes:
      - ./pocketbase/hooks:/pb_hooks
```

### 3. Scaling Considerations

For large user bases (>1000 users):

```javascript
// Add batching in DailyNotifications.pb.js
const BATCH_SIZE = 100;
for (let i = 0; i < participants.length; i += BATCH_SIZE) {
    const batch = participants.slice(i, i + BATCH_SIZE);
    // Process batch
    // Add delay between batches
}
```

### 4. Monitoring & Alerts

Set up alerts for:
- Failed notification rate > 5%
- Cron job not running
- Novu API errors
- Database connection issues

## 📝 Additional Resources

- [Setup Guide](./NOTIFICATIONS_SETUP.md) - Detailed setup instructions
- [Novu Workflows](../docs/NOVU_WORKFLOWS.md) - Email templates and workflow configs
- [PocketBase Hooks Docs](https://pocketbase.io/docs/js-overview/) - Official PocketBase documentation
- [Novu Docs](https://docs.novu.co) - Official Novu documentation

## 🤝 Support

For issues:
1. Check logs first
2. Run test script
3. Verify Novu dashboard
4. Review this README
5. Check environment variables

## 📄 License

Part of the FitClash weight competition app.

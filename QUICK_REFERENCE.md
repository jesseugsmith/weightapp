# Webapp Quick Reference Guide

## New Files Added

### Hooks
- **`src/hooks/useAdminAccess.ts`** - Admin access verification
  - `useAdminAccess()` - Check if user is admin
  - `useRequireAdminAccess(redirectTo?)` - Protect routes, auto-redirect non-admins

### Pages
- **`src/app/(authenticated)/matchmaking/page.tsx`** - Matchmaking queue system
- **`src/app/(authenticated)/activity-feed/page.tsx`** - Social activity feed
- **`src/app/(authenticated)/notifications/page.tsx`** - Notification center
- **`src/app/(authenticated)/admin/layout.tsx`** - Admin layout with access gate
- **`src/app/(authenticated)/admin/settings/page.tsx`** - System settings & feature flags

### Documentation
- **`WEBAPP_DESIGN.md`** - Complete architecture and design documentation
- **`IMPLEMENTATION_NOTES.md`** - Implementation details and next steps
- **`supabase/migrations/webapp_features.sql`** - Database migration script

### Modified Files
- **`src/components/app-sidebar.tsx`** - Updated navigation with new menu items

## Quick Start

### 1. Set Up Database
```bash
# Run the migration script in Supabase SQL Editor
# File: supabase/migrations/webapp_features.sql
```

### 2. Create Admin User
```sql
-- In Supabase SQL Editor, add your user ID to admin table
INSERT INTO public.admin (user_id) 
VALUES ('your-user-id-here');
```

### 3. Test Admin Access
1. Sign in to webapp
2. Navigate to `/admin/dashboard`
3. If you see the admin panel, access control is working!
4. If redirected to home, check that you're in the admin table

### 4. Access New Features
- **Matchmaking**: `/matchmaking`
- **Activity Feed**: `/activity-feed`
- **Notifications**: `/notifications`
- **Admin Settings**: `/admin/settings` (admin only)

## Common Tasks

### Add a New Feature Page

1. Create page file:
```typescript
// src/app/(authenticated)/[feature]/page.tsx
'use client';
import { useAuth } from '@/hooks/useAuth';

export default function FeaturePage() {
  const { user } = useAuth();
  
  return (
    <div className="space-y-6">
      <h1>Feature Name</h1>
      {/* Your content */}
    </div>
  );
}
```

2. Add to sidebar in `src/components/app-sidebar.tsx`:
```typescript
{
  title: "Feature Name",
  url: "/feature",
  icon: IconName,
  items: [],
},
```

### Make a Page Admin-Only

1. Use the layout protection:
```typescript
// Page is automatically protected by admin/layout.tsx
// Just create it under src/app/(authenticated)/admin/[feature]/page.tsx
```

Or use the hook in any page:
```typescript
const { hasAccess, loading } = useRequireAdminAccess('/home');

if (!hasAccess) return null; // Will auto-redirect
```

### Add Real-time Subscriptions

```typescript
useEffect(() => {
  const channel = supabase
    .channel('my-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'my_table' },
      (payload) => {
        console.log('Change received!', payload);
        // Update state
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}, []);
```

### Check User Permissions

```typescript
import { usePermissions } from '@/contexts/PermissionsContext';

const { hasPermission, hasRole, isAdmin } = usePermissions();

if (isAdmin || hasRole('moderator')) {
  // Show admin content
}
```

## Database Quick Reference

### Tables for New Features

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `competition_queue` | Matchmaking | user_id, competition_id, status, joined_at |
| `activity_posts` | Social feed | user_id, activity_type, activity_value, likes, comments |
| `activity_post_likes` | Feed engagement | activity_post_id, user_id |
| `user_follows` | Follow system | follower_id, following_id |
| `notifications` | Notifications | user_id, type, title, message, read |
| `system_settings` | Config | maintenance_mode, feature_*_enabled flags |

### Common Queries

```typescript
// Get user's active competitions from queue
const { data } = await supabase
  .from('competition_queue')
  .select('*')
  .eq('user_id', user.id)
  .eq('status', 'pending');

// Get activity feed
const { data } = await supabase
  .from('activity_posts')
  .select(`
    *,
    user:profiles(first_name, last_name, photo_url)
  `)
  .order('created_at', { ascending: false });

// Get user notifications
const { data } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

## Debugging

### Admin Access Issues
1. Check user is in `admin` table:
   ```sql
   SELECT * FROM public.admin WHERE user_id = 'your-id';
   ```
2. Check auth session is valid
3. Clear browser cache/cookies
4. Check console for error messages

### Real-time Not Working
1. Verify Supabase Realtime is enabled in project
2. Check WebSocket connections in Network tab
3. Verify RLS policies allow operations
4. Check that table subscriptions are set up correctly

### Navigation Not Showing
1. Verify icon imports in `app-sidebar.tsx`
2. Check `navigationData` includes new items
3. Verify `hasAdminAccess` logic for admin items
4. Clear Next.js cache: `rm -rf .next`

## File Structure Reminder

```
weightapp/
├── src/
│   ├── app/
│   │   ├── (authenticated)/
│   │   │   ├── admin/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── users/
│   │   │   │   ├── settings/     ← New!
│   │   │   │   └── layout.tsx    ← Updated!
│   │   │   ├── matchmaking/      ← New!
│   │   │   ├── activity-feed/    ← New!
│   │   │   ├── notifications/    ← New!
│   │   │   └── layout.tsx
│   │   ├── auth/
│   │   ├── api/
│   │   └── page.tsx
│   ├── components/
│   │   ├── app-sidebar.tsx       ← Updated!
│   │   └── ui/
│   ├── hooks/
│   │   ├── useAdminAccess.ts     ← New!
│   │   └── ...
│   ├── contexts/
│   ├── lib/
│   ├── services/
│   ├── types/
│   └── utils/
├── supabase/
│   ├── migrations/
│   │   └── webapp_features.sql   ← New!
│   └── functions/
├── WEBAPP_DESIGN.md              ← New!
├── IMPLEMENTATION_NOTES.md       ← New!
└── ...
```

## Checklist Before Deploying

- [ ] Run database migration (`webapp_features.sql`)
- [ ] Add at least one admin user to `admin` table
- [ ] Test that non-admin cannot access `/admin/*`
- [ ] Test that admin can access `/admin/settings`
- [ ] Verify matchmaking page loads
- [ ] Verify activity feed loads
- [ ] Verify notifications page works
- [ ] Test real-time notifications
- [ ] Check all navigation items appear in sidebar
- [ ] Update Supabase auth callback URL if needed

## Support & Troubleshooting

See `WEBAPP_DESIGN.md` for:
- Detailed architecture
- Security considerations
- Performance optimizations
- Testing guidelines
- Future enhancements

See `IMPLEMENTATION_NOTES.md` for:
- What was implemented
- Database schema details
- Next steps and TODOs
- Code quality notes

# Challngr Web App - Design & Architecture

## Overview

The Challngr Web App is the desktop/web equivalent of the Challngr Mobile App, providing feature parity with enhanced admin capabilities. It's built with Next.js 14, Tailwind CSS, shadcn/ui, and Supabase.

## Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime (for notifications, messages)

### Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── (authenticated)/          # Protected routes (require login)
│   │   ├── admin/               # Admin-only section
│   │   │   ├── dashboard/       # Admin overview & statistics
│   │   │   ├── users/           # User management
│   │   │   ├── roles/           # Role & permission management
│   │   │   ├── settings/        # System settings & feature flags
│   │   │   ├── audit-logs/      # System audit trail
│   │   │   └── layout.tsx       # Admin layout with access gate
│   │   ├── home/                # Dashboard & overview
│   │   ├── competitions/        # Browse & manage competitions
│   │   ├── matchmaking/         # Matchmaking queue system
│   │   ├── activity-feed/       # Social activity feed
│   │   ├── messaging/           # Competition messaging
│   │   ├── notifications/       # Notification center
│   │   ├── profile/             # User profile
│   │   ├── api-tokens/          # API token management
│   │   ├── settings/            # User settings
│   │   └── layout.tsx           # Auth layout wrapper
│   ├── auth/                    # Public auth routes
│   │   ├── signin/
│   │   └── signup/
│   ├── api/                     # API routes
│   │   ├── competitions/
│   │   ├── activities/
│   │   ├── notifications/
│   │   └── admin/
│   └── page.tsx                 # Landing page / home redirect
├── components/                   # Reusable React components
│   ├── app-sidebar.tsx          # Main navigation sidebar
│   ├── nav-main.tsx             # Main navigation items
│   ├── nav-user.tsx             # User menu
│   ├── ActivityLogger.tsx        # Log activity form
│   ├── LeaderboardCard.tsx       # Competition leaderboard
│   └── ui/                      # shadcn/ui primitives
├── contexts/                     # React contexts
│   ├── AuthContext.tsx          # Authentication state
│   ├── PermissionsContext.tsx   # Role-based access control
│   └── ThemeContext.tsx         # Theme management
├── hooks/                       # Custom React hooks
│   ├── useAuth.tsx              # Auth hook
│   ├── useAdminAccess.ts        # Admin access verification
│   ├── useProfile.ts            # Profile data hook
│   └── useNotifications.ts      # Notification subscriptions
├── lib/                         # Utility functions
│   ├── supabase.ts              # Supabase client factory
│   ├── supabaseAuth.ts          # Auth helpers
│   └── permissions.ts           # Permission utilities
├── services/                    # Business logic services
│   ├── competitionService.ts    # (shared from mobile)
│   └── activityService.ts
├── types/                       # TypeScript types
│   └── supabase.types.ts        # Generated Supabase types
└── utils/                       # Utility helpers
```

## Features

### User Features (Feature Parity with Mobile)

#### 1. **Home / Dashboard**
- Overview of active competitions
- Recent weight/activity entries
- Personal stats (weight loss, total activities, etc.)
- Quick access to common actions
- Recent activity history

#### 2. **Competitions**
- Browse all available competitions
- Create new competitions with flexible options
- Join public or code-locked competitions
- View competition details and leaderboards
- Team competition support
- Competition status tracking (draft → started → completed)

#### 3. **Matchmaking** (NEW)
- Join matchmaking queues for automatic player matching
- Real-time queue status updates
- View matched competitions
- Support for multiple game queues simultaneously

#### 4. **Activity Feed** (NEW)
- View activity posts from other users
- Follow/unfollow functionality
- Like and comment on posts
- Filter by all activity or following only
- Activity posts tied to competitions

#### 5. **Messaging**
- Competition-specific group chats
- Real-time message delivery
- Unread message indicators
- Message history

#### 6. **Notifications** (NEW)
- Unified notification center
- Real-time notification delivery
- Mark notifications as read/unread
- Filter by read/unread status
- Delete individual or all notifications
- Notification types:
  - Competition started/ended
  - Join request accepted/rejected
  - Leaderboard updates
  - Messages received

#### 7. **User Profile**
- Edit profile information (name, bio, photo)
- View personal statistics
- Achievement/milestone tracking
- Health data integration settings

#### 8. **Settings**
- Theme preferences
- Notification preferences
- Privacy settings
- Account management

### Admin Features

#### 1. **Admin Dashboard**
- System overview and statistics
- Active competitions management
- User activity monitoring
- System health indicators
- Quick action panels

#### 2. **User Management**
- View all users with filters
- User details and activity history
- Deactivate/reactivate users
- View user roles and permissions
- User search and pagination

#### 3. **Role & Permission Management**
- Create and edit roles
- Assign permissions to roles
- View role hierarchy
- Bulk role assignments
- Permission audit trail

#### 4. **System Settings** (NEW)
- Feature flags:
  - Enable/disable matchmaking
  - Enable/disable social feed
  - Enable/disable public competitions
- User limits configuration
- Maintenance mode toggle
- System parameter tuning

#### 5. **Audit Logs**
- View all system activities
- Filter by action type, user, or date range
- Search capabilities
- Export audit logs
- User action tracking

#### 6. **Invite Management**
- Generate signup invite tokens
- Track invite usage
- Revoke invites
- Bulk invite creation

## Access Control

### Admin Access Gate

The admin section is protected by a two-layer access control system:

1. **Database Check**: `admin` table query with user_id
2. **Hook-based Verification**: `useRequireAdminAccess()` hook
3. **Layout Protection**: Admin layout redirects non-admins

```typescript
// Admin routes automatically check admin status
export function useAdminAccess(): { isAdmin: boolean; loading: boolean; error: string | null }
export function useRequireAdminAccess(redirectTo?: string): { hasAccess: boolean; ... }
```

### Role-Based Access Control (RBAC)

For granular permission control, use the existing `PermissionsContext`:

```typescript
const { hasPermission, hasRole, isAdmin } = usePermissions();

if (hasRole('admin') || hasPermission('manage_users')) {
  // Show admin content
}
```

## Database Schema Integration

### Key Tables
- `profiles` - User account information
- `competitions` - Competition definitions
- `competition_participants` - Participation records
- `competition_join_requests` - Join request queue
- `team_participants` - Team competition entries
- `weight_entries` - Weight tracking data
- `activity_logs` - User activity records
- `messages` - Competition messages
- `notifications` - User notifications
- `admin` - Admin user registry
- `user_roles` - Role assignments
- `activity_posts` - Social feed posts
- `activity_post_likes` - Post engagement
- `competition_queue` - Matchmaking queue
- `system_settings` - Global configuration

## Navigation Structure

### Main Sidebar (Authenticated Users)
```
├── Home
├── Competitions
├── Matchmaking
├── Activity Feed
├── Messages
└── Admin (conditional - admin users only)
    ├── Dashboard
    ├── Users
    ├── Roles
    ├── Audit Logs
    └── Settings
```

### Secondary Actions (Top Bar)
- Notifications (bell icon with unread count)
- Log Activity (quick action)
- API Tokens
- Support

### User Menu (Bottom of Sidebar)
- User profile dropdown
- Sign out
- Settings shortcut

## Real-time Features

### Subscriptions
- **Messages**: Real-time chat updates
- **Notifications**: Instant notification delivery
- **Leaderboards**: Live ranking updates during active competitions
- **Activity Feed**: New post notifications

### Implementation
Uses Supabase Realtime channels with PostgreSQL listen/notify:

```typescript
// Example: Subscribe to competition messages
const channel = supabase
  .channel(`competition:${competitionId}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'messages' },
    (payload) => { /* update UI */ }
  )
  .subscribe();
```

## Security Considerations

### Authentication
- Supabase Auth session management
- Secure token storage in HTTP-only cookies (via Supabase)
- Session verification on every server request

### Authorization
- Admin table check for admin routes
- RLS (Row Level Security) policies on Supabase tables
- Permission-based access control via roles

### Data Protection
- All user data requests filtered by user_id (RLS)
- Admin actions logged in audit_logs table
- Sensitive operations require confirmation

## Performance Optimizations

### Frontend
- Next.js Image optimization
- Lazy loading of heavy components
- Memoized context values
- Efficient query subscriptions

### Backend
- Indexed database queries
- Pagination on list views
- Caching via Supabase
- Efficient RLS policies

## Development Workflow

### Getting Started
```bash
cd weightapp
npm install
npm run dev
```

### Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WEB_URL=
```

### Adding New Pages
1. Create file under `src/app/(authenticated)/[feature]/page.tsx`
2. Add to sidebar navigation in `app-sidebar.tsx`
3. Add to breadcrumb logic if needed
4. Wire up authentication/authorization hooks

### Adding Admin Features
1. Create page under `src/app/(authenticated)/admin/[feature]/`
2. Use `useRequireAdminAccess()` hook to gate access
3. Check permissions with `usePermissions()` if granular control needed
4. Add to admin sidebar menu

## Testing

### Admin Access
Test that non-admin users are redirected from `/admin/*` routes

### Feature Flags
Toggle feature flags in admin settings and verify UI updates

### Real-time Features
Verify message delivery, notification updates, and leaderboard changes in real-time

## Future Enhancements

1. **Mobile Admin** - Bring admin features to mobile app for mods on-the-go
2. **Advanced Analytics** - User engagement metrics, competition statistics
3. **Bulk Operations** - Batch user/competition management
4. **Export/Import** - Data export for reporting
5. **Webhooks** - External system integrations
6. **Two-Factor Authentication** - Enhanced account security for admins
7. **Activity Moderation** - Flag/remove inappropriate activity posts
8. **Advanced Matchmaking** - Skill-based matching algorithms

## Deployment

The webapp is deployed to Vercel with automatic deployments on:
- Push to main branch
- Pull request commits (preview deployments)

### Environment Setup
- Production: Full feature set
- Staging: Feature flags can be toggled for testing
- Local: All features enabled by default

## Troubleshooting

### Admin Pages Not Showing
- Check that user exists in `admin` table
- Verify Supabase auth session is valid
- Check browser console for auth errors

### Real-time Updates Not Working
- Verify Supabase Realtime is enabled in project settings
- Check network tab for WebSocket connections
- Confirm RLS policies allow the operation

### Styling Issues
- Ensure Tailwind CSS is properly configured
- Check shadcn/ui component imports
- Verify dark mode is configured correctly

## Contributing

When adding features:
1. Maintain feature parity with mobile where applicable
2. Follow the existing component structure
3. Use shadcn/ui components for UI consistency
4. Add proper TypeScript types
5. Test admin access gating for admin features
6. Update this documentation

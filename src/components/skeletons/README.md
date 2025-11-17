# Skeleton Loading Components

A comprehensive system of skeleton loaders to improve perceived performance and user experience during data loading.

## Why Skeletons Over Spinners?

✅ **Better perceived performance** - Users see structure immediately  
✅ **Reduced cognitive load** - Shows what content is coming  
✅ **Layout stability** - No jarring shifts when content loads  
✅ **Modern UX** - Used by Facebook, LinkedIn, YouTube, etc.  
✅ **Reduced anxiety** - Spinners feel "stuck", skeletons show progress  

## Available Components

### Base Skeleton
```tsx
import { Skeleton } from '@/components/skeletons';

<Skeleton className="h-4 w-48" />
<Skeleton variant="circular" className="h-12 w-12" />
<Skeleton variant="text" className="w-full" />
<Skeleton animation="wave" className="h-20 w-full" />
```

**Props:**
- `variant`: `'default' | 'text' | 'circular' | 'rectangular'`
- `animation`: `'pulse' | 'wave' | 'none'`
- `className`: Additional Tailwind classes

### Leaderboard Skeleton
```tsx
import { LeaderboardSkeleton } from '@/components/skeletons';

<LeaderboardSkeleton 
  showPodium={true}
  participantCount={5}
/>
```

**Use for:** Competition leaderboards, rankings, standings

### Activity History Skeleton
```tsx
import { ActivityHistorySkeleton } from '@/components/skeletons';

<ActivityHistorySkeleton itemCount={5} />
```

**Use for:** Activity feeds, history lists, timeline views

### Card Skeleton
```tsx
import { CardSkeleton } from '@/components/skeletons';

<CardSkeleton 
  hasHeader={true}
  hasFooter={true}
  contentLines={3}
/>
```

**Use for:** Competition cards, profile cards, info cards

### List Skeleton
```tsx
import { ListSkeleton } from '@/components/skeletons';

<ListSkeleton 
  itemCount={5}
  hasAvatar={true}
  hasActions={true}
/>
```

**Use for:** User lists, competition lists, search results

### Table Skeleton
```tsx
import { TableSkeleton } from '@/components/skeletons';

<TableSkeleton 
  columns={4}
  rows={5}
  hasHeader={true}
/>
```

**Use for:** Data tables, standings tables, analytics

### Profile Skeleton
```tsx
import { ProfileSkeleton } from '@/components/skeletons';

<ProfileSkeleton variant="full" />
<ProfileSkeleton variant="card" />
```

**Use for:** Profile pages, user cards, profile modals

## Migration Guide

### Before (with LoadingSpinner)
```tsx
if (loading) return <LoadingSpinner />;
```

### After (with Skeleton)
```tsx
if (loading) return <LeaderboardSkeleton participantCount={5} />;
```

## Animation Types

### Pulse (Default)
Gentle pulsing effect - good for most use cases.

### Wave
Shimmer effect that moves across the skeleton - more visually engaging.

### None
Static skeleton - use for subtle loading states.

## Best Practices

1. **Match the structure** - Skeleton should closely match the loaded content layout
2. **Use appropriate counts** - Show realistic number of items (e.g., if you load 10, show 10 skeletons)
3. **Consistent timing** - Keep skeleton visible for at least 300ms to avoid flashing
4. **Accessibility** - Skeletons are decorative, ensure screen readers announce loading states
5. **Don't overuse** - For very quick operations (<200ms), consider no loading state

## Components Already Updated

- ✅ `LeaderboardCard.tsx` - Uses `LeaderboardSkeleton`
- ✅ `ActivityHistory.tsx` - Uses `ActivityHistorySkeleton`

## Components to Update

Consider updating these components:
- `CompetitionMessagingBoard.tsx`
- `DigestView.tsx`
- `NotificationInbox.tsx`
- Any component currently using `LoadingSpinner`

## Custom Skeletons

For unique layouts, compose custom skeletons:

```tsx
function MyCustomSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="h-16 w-16" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
```

## When to Still Use Spinners

- **Button loading states** - Small inline actions
- **Modal/overlay loading** - Full-screen blocking operations
- **Very quick operations** - Sub-200ms loads
- **Unpredictable layouts** - Content structure unknown

## Performance Notes

Skeletons are lightweight and performant:
- Pure CSS animations (no JS)
- No additional network requests
- Minimal DOM elements
- GPU-accelerated animations

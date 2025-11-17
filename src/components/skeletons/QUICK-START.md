# Skeleton Components - Quick Start Guide

## 🚀 5-Minute Integration

### Step 1: Import the skeleton
```tsx
import { LeaderboardSkeleton } from '@/components/skeletons';
```

### Step 2: Replace your loading spinner
```tsx
// Before ❌
if (loading) {
  return <LoadingSpinner message="Loading..." />;
}

// After ✅
if (loading) {
  return <LeaderboardSkeleton participantCount={5} />;
}
```

### Step 3: Done! 🎉

## 📋 Common Use Cases

### Loading a List
```tsx
import { ListSkeleton } from '@/components/skeletons';

if (loading) {
  return <ListSkeleton itemCount={10} hasAvatar={true} />;
}
```

### Loading Cards
```tsx
import { CardSkeleton } from '@/components/skeletons';

if (loading) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
```

### Loading a Profile
```tsx
import { ProfileSkeleton } from '@/components/skeletons';

if (loading) {
  return <ProfileSkeleton variant="full" />;
}
```

### Loading a Table
```tsx
import { TableSkeleton } from '@/components/skeletons';

if (loading) {
  return <TableSkeleton columns={5} rows={10} />;
}
```

## 🎨 Custom Skeletons

Build your own in 3 steps:

```tsx
import { Skeleton } from '@/components/skeletons';

function MyCustomSkeleton() {
  return (
    <div className="space-y-4">
      {/* 1. Header with avatar */}
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="h-12 w-12" />
        <Skeleton className="h-6 w-48" />
      </div>
      
      {/* 2. Content area */}
      <Skeleton className="h-32 w-full" />
      
      {/* 3. Footer actions */}
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  );
}
```

## ⚡ Pro Tips

**Tip 1: Match your data count**
```tsx
// If you're loading 15 items, show 15 skeletons
<ListSkeleton itemCount={items.length || 15} />
```

**Tip 2: Use wave animation for emphasis**
```tsx
<Skeleton animation="wave" className="h-64 w-full" />
```

**Tip 3: Prevent flashing**
```tsx
const [showSkeleton, setShowSkeleton] = useState(false);

useEffect(() => {
  // Only show skeleton after 300ms to prevent flash on fast loads
  const timer = setTimeout(() => setShowSkeleton(true), 300);
  return () => clearTimeout(timer);
}, []);

if (loading && showSkeleton) {
  return <LeaderboardSkeleton />;
}
```

## 📦 All Available Skeletons

```tsx
import {
  Skeleton,                    // Base component
  LeaderboardSkeleton,         // Competition leaderboards
  ActivityHistorySkeleton,     // Activity feeds
  CardSkeleton,                // Generic cards
  ListSkeleton,                // Lists with items
  TableSkeleton,               // Data tables
  ProfileSkeleton,             // User profiles
  CompetitionCardSkeleton,     // Competition cards
} from '@/components/skeletons';
```

## 🔍 Need Help?

- **Full docs**: `/src/components/skeletons/README.md`
- **Examples**: `/src/components/skeletons/SkeletonDemo.tsx`
- **Already implemented**: `LeaderboardCard.tsx`, `ActivityHistory.tsx`

## ✅ Quick Checklist

- [ ] Import the skeleton component
- [ ] Replace `<LoadingSpinner />` with skeleton
- [ ] Match the skeleton structure to your content
- [ ] Set appropriate item counts/options
- [ ] Test with slow 3G (DevTools)
- [ ] Verify no layout shift when content loads

---

**That's it!** You're now using modern skeleton loaders. 🎉

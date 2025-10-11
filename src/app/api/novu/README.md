# Novu Server-Side API Routes

This directory contains secure server-side API routes for integrating with Novu push notifications.

## Overview

All Novu API calls are now handled server-side to keep API keys secure and provide proper authentication. The routes use PocketBase authentication to verify users before making Novu API calls.

## API Routes

### 1. POST `/api/novu/register-subscriber`

Registers or updates a subscriber in Novu with their profile information.

**Authentication:** Required (PocketBase cookie)

**Request Body:**
```json
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscriber registered with Novu",
  "data": { /* Novu subscriber object */ }
}
```

**Usage:**
Called automatically when a user logs in via `useNovuPush()` hook.

---

### 2. POST `/api/novu/register-push`

Registers a user's push notification subscription credentials with Novu.

**Authentication:** Required (PocketBase cookie)

**Request Body:**
```json
{
  "userId": "user123",
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push credentials registered",
  "data": { /* Novu response */ }
}
```

**Usage:**
Called automatically after browser push permission is granted via `useNovuPush()` hook.

---

### 3. PUT `/api/novu/update-subscriber`

Updates subscriber information in Novu (e.g., when user updates their profile).

**Authentication:** Required (PocketBase cookie)

**Request Body:**
```json
{
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscriber updated in Novu",
  "data": { /* Updated subscriber object */ }
}
```

**Usage:**
Call `updateNovuSubscriber()` from client when profile is updated.

---

### 4. POST `/api/novu/send-test-notification`

Sends a test notification to the authenticated user, demonstrating how first and last names are included.

**Authentication:** Required (PocketBase cookie)

**Request Body:** None required (uses authenticated user's profile)

**Response:**
```json
{
  "success": true,
  "message": "Test notification sent successfully",
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "sentAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Usage:**
Test endpoint to verify Novu setup and name inclusion in notifications.

---

## Environment Variables

### Server-Side (Vercel Secret)
- `NOVU_API_KEY` - Your Novu API key (keep this secret!)

### Client-Side (Public)
- `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER` - Your Novu Application ID
- `NEXT_PUBLIC_NOVU_VAPID_PUBLIC_KEY` - VAPID public key for web push
- `NEXT_PUBLIC_POCKETBASE_URL` - PocketBase instance URL

## Security Features

### Authentication
All routes verify the user's PocketBase session cookie before processing requests. This ensures:
- Only authenticated users can make Novu API calls
- Users can only register/update their own data
- API keys never exposed to the client

### Authorization
- Routes verify `userId` matches the authenticated user
- Email validation to prevent unauthorized updates
- Proper error handling and logging

### Rate Limiting
Consider adding rate limiting middleware to prevent abuse:
```typescript
// middleware.ts
import { ratelimit } from '@/lib/ratelimit';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/novu')) {
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
  }
}
```

## Client Usage

### Setup Push Notifications
```typescript
import { useNovuPush } from '@/hooks/useNovuPush';

function MyComponent() {
  useNovuPush(); // Automatically sets up push when user logs in
  return <div>App Content</div>;
}
```

### Update Subscriber
```typescript
import { updateNovuSubscriber } from '@/hooks/useNovuPush';

async function updateProfile(userId: string, email: string, firstName: string, lastName: string) {
  const success = await updateNovuSubscriber(userId, email, firstName, lastName);
  if (success) {
    console.log('Subscriber updated!');
  }
}
```

## Deployment on Vercel

1. **Set Environment Variables:**
   - Go to your Vercel project settings
   - Add `NOVU_API_KEY` as a secret environment variable
   - Add public variables (NEXT_PUBLIC_*)

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Verify:**
   - Check Vercel logs for any errors
   - Test push notification registration
   - Monitor Novu dashboard for subscriber activity

## Troubleshooting

### "Unauthorized" Error
- Check that PocketBase authentication is working
- Verify `pb_auth` cookie is being set correctly
- Ensure `NEXT_PUBLIC_POCKETBASE_URL` is configured

### "Server configuration error"
- Verify `NOVU_API_KEY` is set in Vercel environment variables
- Redeploy after adding environment variables

### Push registration fails
- Check browser console for detailed errors
- Verify VAPID keys are correct
- Test with different browsers
- Check Novu dashboard for error logs

## Testing

Test the API routes locally:

```bash
# Test subscriber registration
curl -X POST http://localhost:3000/api/novu/register-subscriber \
  -H "Content-Type: application/json" \
  -H "Cookie: pb_auth=YOUR_AUTH_COOKIE" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User"}'

# Test subscriber update
curl -X PUT http://localhost:3000/api/novu/update-subscriber \
  -H "Content-Type: application/json" \
  -H "Cookie: pb_auth=YOUR_AUTH_COOKIE" \
  -d '{"email":"test@example.com","firstName":"Updated","lastName":"Name"}'
```

## Architecture Benefits

✅ **Security:** API keys never exposed to client  
✅ **Authentication:** Proper session verification  
✅ **Authorization:** User-specific data access  
✅ **Centralized:** All Novu logic in one place  
✅ **Maintainable:** Easy to update and debug  
✅ **Scalable:** Works seamlessly on Vercel serverless  

## Next Steps

Consider implementing:
- [ ] Rate limiting middleware
- [ ] Request logging and monitoring
- [ ] Batch operations for multiple subscribers
- [ ] Webhook endpoints for Novu events
- [ ] Integration tests for API routes

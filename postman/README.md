# Postman Collection - Notification Queue API

This Postman collection provides endpoints for testing the notification queue processing system.

## Setup

### 1. Import the Collection

1. Open Postman
2. Click **Import** button
3. Select `Notification Queue API.postman_collection.json`
4. The collection will be imported with all endpoints

### 2. Configure Environment Variables

The collection uses two variables that you need to set:

1. **BASE_URL**: Your API base URL
   - Local: `http://localhost:3000`
   - Production: `https://your-domain.com`

2. **SERVICE_ROLE_KEY**: Your Supabase service role key
   - Found in your Supabase project settings under API
   - **Important**: Keep this secure and never commit it to version control

### Setting Variables

**Option 1: Collection Variables (Recommended)**
1. Right-click on the collection
2. Select **Edit**
3. Go to the **Variables** tab
4. Set `BASE_URL` and `SERVICE_ROLE_KEY`
5. Click **Save**

**Option 2: Environment Variables**
1. Create a new environment in Postman
2. Add variables:
   - `BASE_URL` = `http://localhost:3000`
   - `SERVICE_ROLE_KEY` = `your-service-role-key`
3. Select the environment from the dropdown

## Endpoints

### 1. Process Queue (POST)

Processes unprocessed notifications from the queue and sends them to Novu.

**Endpoint:** `POST /api/novu/process-queue`

**Query Parameters:**
- `batchSize` (optional): Number of notifications to process (default: 50)

**Example:**
```
POST {{BASE_URL}}/api/novu/process-queue?batchSize=50
Authorization: Bearer {{SERVICE_ROLE_KEY}}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Processed 10 notifications, 0 failed",
  "processed": 10,
  "failed": 0,
  "total": 10
}
```

### 2. Check Queue Status (GET)

Returns the number of pending notifications in the queue.

**Endpoint:** `GET /api/novu/process-queue`

**Example:**
```
GET {{BASE_URL}}/api/novu/process-queue
Authorization: Bearer {{SERVICE_ROLE_KEY}}
```

**Success Response:**
```json
{
  "success": true,
  "pending": 5
}
```

## Testing Workflow

1. **Check Queue Status**: First, check how many notifications are pending
2. **Process Queue**: Process the notifications (adjust batchSize if needed)
3. **Verify**: Check queue status again to confirm notifications were processed

## Authentication

All endpoints require Bearer token authentication using the Supabase service role key. The collection is pre-configured with Bearer auth, so you just need to set the `SERVICE_ROLE_KEY` variable.

## Troubleshooting

### 401 Unauthorized
- Verify `SERVICE_ROLE_KEY` is set correctly
- Ensure the key is the service role key (not the anon key)
- Check that the Authorization header is being sent

### 500 Server Error
- Check that `NOVU_API_KEY` is configured in your environment
- Verify Supabase connection is working
- Check server logs for detailed error messages

### No Notifications Processed
- Verify there are unprocessed notifications in the database
- Check that notifications have `push_sent_at IS NULL`
- Ensure notifications are not marked as read (`is_read = false`)

## Example cURL Commands

If you prefer using cURL instead of Postman:

```bash
# Check queue status
curl -X GET "http://localhost:3000/api/novu/process-queue" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Process queue
curl -X POST "http://localhost:3000/api/novu/process-queue?batchSize=50" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```


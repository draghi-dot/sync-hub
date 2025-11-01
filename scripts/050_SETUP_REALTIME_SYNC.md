# Setup Realtime Sync for Messages

This guide will help you enable real-time message synchronization in your Supabase database.

## Problem

If real-time message updates are not working, messages only appear after the 3-second polling interval instead of instantly. This happens when the `messages` table is not enabled for Supabase Realtime.

## Solution

### Step 1: Enable Realtime in Supabase Database

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor**

2. **Run the Enable Realtime Script**
   - Open the file: `scripts/048_enable_realtime_sync.sql`
   - Copy the SQL content
   - Paste it into the Supabase SQL Editor
   - Click **Run**

   This script will:
   - Set `REPLICA IDENTITY FULL` for the tables (required for realtime)
   - Add the `messages`, `chats`, and `chat_members` tables to the `supabase_realtime` publication
   - Verify the setup and show you the results

3. **Verify Setup**
   - Run `scripts/049_verify_realtime_setup.sql` in SQL Editor
   - This will show you which tables have realtime enabled
   - You should see ✅ for `messages` table

### Step 2: Alternative Method (Using UI)

If the SQL script doesn't work, you can enable realtime via the Supabase dashboard:

1. Go to **Table Editor** in Supabase Dashboard
2. Select the `messages` table
3. Click the **"Enable Realtime"** button (should be visible near the table name)
4. Repeat for `chats` and `chat_members` tables (optional but recommended)

### Step 3: Test Realtime

1. Open your app in two different browser windows/tabs
2. Login as different users in each
3. Send a message from one user
4. The message should appear **instantly** in the other window (within 1 second)
5. Check the browser console - you should see:
   - `✅ Successfully subscribed to real-time updates for chat: [chatId]`
   - `✅ New message received via realtime: [payload]`

### Step 4: Troubleshooting

If realtime still doesn't work:

1. **Check Console Logs**
   - Open browser DevTools (F12)
   - Look for realtime subscription status messages
   - If you see `⚠️ Realtime subscription error`, realtime is not enabled

2. **Verify in Database**
   - Run `scripts/049_verify_realtime_setup.sql`
   - Ensure `messages` table shows as enabled

3. **Check Supabase Project Settings**
   - Go to **Project Settings** → **API**
   - Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
   - Ensure Realtime is enabled for your project plan

4. **Check Network Tab**
   - Open DevTools → Network tab
   - Filter for "realtime" or "websocket"
   - You should see WebSocket connections to Supabase Realtime

5. **Common Issues**
   - **RLS Policies**: Ensure your RLS policies allow users to read messages they're members of
   - **REPLICA IDENTITY**: The tables must have `REPLICA IDENTITY FULL` set (the script does this automatically)
   - **Publication Access**: The `supabase_realtime` publication should be accessible
   - **Connection Issues**: Check if WebSocket connections are blocked by firewall/proxy
   - **Table Not in Publication**: If you see errors, verify the table is in `pg_publication_tables`
   
6. **Check REPLICA IDENTITY**
   - Run this query to check:
   ```sql
   SELECT 
       c.relname as table_name,
       CASE c.relreplident
           WHEN 'f' THEN 'FULL ✅'
           WHEN 'n' THEN 'NOTHING ❌ - Run: ALTER TABLE messages REPLICA IDENTITY FULL'
           ELSE 'OTHER'
       END as replica_identity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'messages';
   ```

## What Changed in the Code

The `chat-messages.tsx` component has been improved with:
- Better error handling for realtime subscriptions
- More detailed console logging for debugging
- Graceful fallback to polling if realtime fails
- Clear error messages guiding users to enable realtime

## Expected Behavior

**With Realtime Enabled:**
- Messages appear instantly (< 1 second)
- Console shows: `✅ Successfully subscribed to real-time updates`
- Console shows: `✅ New message received via realtime`
- Polling still runs as fallback (but not needed)

**Without Realtime:**
- Messages appear after 3-second polling interval
- Console shows: `⚠️ Realtime subscription error - using polling fallback`
- Polling is the primary mechanism

## Files Modified

1. `scripts/048_enable_realtime_sync.sql` - SQL script to enable realtime
2. `scripts/049_verify_realtime_setup.sql` - Verification script
3. `components/chat/chat-messages.tsx` - Improved error handling and logging

## Next Steps

After enabling realtime, refresh your app and test sending messages. The realtime subscription should work automatically once the database is configured correctly.


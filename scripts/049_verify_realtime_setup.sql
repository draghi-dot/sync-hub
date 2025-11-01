-- Verify Realtime Setup
-- This script checks if realtime is properly enabled for the necessary tables

-- Check which tables are in the realtime publication
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN tablename IN ('messages', 'chats', 'chat_members') THEN '✅ Enabled'
        ELSE '⚠️ Not needed'
    END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND schemaname = 'public'
ORDER BY tablename;

-- Check if messages table is enabled (most critical)
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'messages'
        ) THEN '✅ Messages realtime is ENABLED'
        ELSE '❌ Messages realtime is DISABLED - Run 048_enable_realtime_sync.sql'
    END as messages_realtime_status;

-- Check if chats table is enabled
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'chats'
        ) THEN '✅ Chats realtime is ENABLED'
        ELSE '⚠️ Chats realtime is DISABLED (optional)'
    END as chats_realtime_status;

-- Check if chat_members table is enabled
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'chat_members'
        ) THEN '✅ Chat_members realtime is ENABLED'
        ELSE '⚠️ Chat_members realtime is DISABLED (optional)'
    END as chat_members_realtime_status;


# Fix Group Chat Creation Error

If you're getting an error when trying to create a group chat, this guide will help you fix it.

## Common Error Messages

- "Failed to create group chat: Permission denied (RLS Policy)"
- "Failed to add members: row-level security policy violation"
- "new row violates row-level security policy"

## Quick Fix

**Run this SQL script in Supabase SQL Editor:**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file: `scripts/051_fix_group_chat_creation.sql`
3. Copy and paste the entire SQL into the SQL Editor
4. Click **Run**
5. Verify you see success messages (✅) in the results
6. Try creating a group chat again

## What This Script Does

The script fixes Row Level Security (RLS) policies that prevent group chat creation:

1. **Chats INSERT Policy** - Allows authenticated users to create group chats
2. **Chat Members INSERT Policy** - Allows chat creators to add members to their group chats
3. **Chats SELECT Policy** - Allows users to see chats they created or are members of
4. **Chat Members SELECT Policy** - Allows users to see memberships without recursion

## Why This Error Happens

The error occurs because:
- RLS policies may have recursion issues (checking `chat_members` while inserting into `chat_members`)
- The policy might not allow chat creators to add members during group creation
- Conflicting policies from different scripts might interfere with each other

## Step-by-Step Fix

### Option 1: Run the Fix Script (Recommended)

```bash
# In Supabase SQL Editor, run:
scripts/051_fix_group_chat_creation.sql
```

### Option 2: Manual Fix

If the script doesn't work, you can run these commands individually:

1. **Fix chats INSERT policy:**
```sql
DROP POLICY IF EXISTS chats_insert_authenticated ON public.chats;

CREATE POLICY chats_insert_authenticated ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (
    type IN ('dm', 'group') AND created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

2. **Fix chat_members INSERT policy:**
```sql
DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;

CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_members.chat_id
        AND c.created_by = auth.uid()
        AND c.type IN ('dm', 'group')
    )
  );
```

## Verification

After running the script, verify it worked:

1. **Check policies exist:**
```sql
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE tablename IN ('chats', 'chat_members')
  AND schemaname = 'public'
ORDER BY tablename, cmd;
```

You should see:
- `chats_insert_authenticated` (INSERT)
- `chat_members_insert_own` (INSERT)

2. **Test group creation:**
- Try creating a group chat with 3+ members
- It should work without errors

## Still Not Working?

If group chat creation still fails after running the script:

1. **Check browser console** for detailed error messages
2. **Check Supabase logs** in Dashboard → Logs → Postgres Logs
3. **Verify user permissions:**
   ```sql
   -- Check if you're authenticated
   SELECT auth.uid();
   
   -- Check your profile
   SELECT id, full_name, email, is_admin
   FROM public.profiles
   WHERE id = auth.uid();
   ```

4. **Check if tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN ('chats', 'chat_members');
   ```

5. **Clear conflicting policies:**
   ```sql
   -- List all policies
   SELECT * FROM pg_policies 
   WHERE tablename IN ('chats', 'chat_members');
   
   -- If you see duplicate or conflicting policies, drop them:
   DROP POLICY IF EXISTS conflicting_policy_name ON public.chats;
   ```

## Related Scripts

- `scripts/041_fix_group_chat_rls.sql` - Original fix for group chat RLS
- `scripts/042_fix_group_chat_rls.sql` - Comprehensive RLS fix
- `scripts/045_completely_fix_chat_members_rls.sql` - Complete chat_members fix
- `scripts/047_fix_all_recursion.sql` - Fix recursion issues

## Expected Behavior After Fix

- ✅ Users can create group chats
- ✅ Group creators can add members during creation
- ✅ Members can see and participate in group chats
- ✅ No recursion errors in RLS policies


# Multiple Departments Setup Guide

This guide explains how to set up the multiple departments feature for users.

## Overview

Users can now be assigned to **multiple departments** instead of just one. The access code for a department (e.g., "CyberSecurity") is the same across all teams/applications within a company. For example, if a user works in "CyberSecurity" for both Photoshop and Illustrator, they use the same access code.

## Changes Made

1. **New Table**: `user_departments` - Junction table for many-to-many relationship between users and departments
2. **Profile Edit Dialog**: Updated to allow adding/removing multiple departments
3. **Department Access**: Removed "no password required" text after department selection
4. **Access Code Verification**: Now based on department name (not team-specific)
5. **RLS Policies**: Updated to check `user_departments` table instead of `profile.department`

## Setup Instructions

### Step 1: Run the Database Migration

Execute the following SQL scripts in order in your Supabase SQL Editor:

1. **`027_create_user_departments.sql`**
   - Creates the `user_departments` junction table
   - Sets up RLS policies
   - Migrates existing single department assignments to the new table

2. **`028_update_rls_for_multiple_departments.sql`**
   - Updates RLS policies for `chats` and `messages` to use `user_departments`
   - Allows users in multiple departments to access department chats

### Step 2: Verify Access Codes

Make sure that departments with the **same name** have the **same access code** across all teams. For example:
- Photoshop > CyberSecurity: `PS-SEC-9251`
- Illustrator > CyberSecurity: `PS-SEC-9251` (should be the same!)
- InDesign > CyberSecurity: `PS-SEC-9251` (should be the same!)

If they are different, you'll need to update them in the `departments` table.

## How It Works

### Adding Departments in Profile

1. User selects a company and verifies with company code
2. User can see all unique departments for that company (not filtered by team)
3. User selects a department and enters the access code
4. Access code is verified against any department with that name
5. Department is added to user's assigned departments
6. User can add multiple departments
7. User can remove departments by clicking the X button on department badges

### Department Access

- When a user clicks on a department they're assigned to, they can access it directly (no password needed)
- When a user clicks on a department they're NOT assigned to, they need to enter the access code
- The access code is the same for all departments with the same name (e.g., "CyberSecurity" has the same code whether it's Photoshop, Illustrator, or InDesign)

### Displaying Departments

- Profile page shows all assigned departments
- Teams page filters departments to only show those the user is assigned to
- Department chat page verifies user is assigned to the department before allowing access

## Testing

After running the scripts:

1. Edit your profile and add a department (e.g., "CyberSecurity")
2. Verify you can see "CyberSecurity" in all teams (Photoshop, Illustrator, InDesign) if you have access
3. Try adding another department
4. Check that your profile displays all assigned departments
5. Verify that department chats work for all assigned departments

## Troubleshooting

### "User is not assigned to any department" error

- Make sure you've run `027_create_user_departments.sql`
- Check that your existing department assignments were migrated
- Try adding a department through the profile edit dialog

### Can't access department chat

- Make sure you've run `028_update_rls_for_multiple_departments.sql`
- Verify you're assigned to the department in `user_departments` table
- Check RLS policies are correctly set

### Access code not working

- Verify that all departments with the same name have the same access code
- Check the `departments` table for consistency


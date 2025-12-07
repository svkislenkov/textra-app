# Textra App - Project Context

**Last Updated:** 2025-12-06

## Project Overview

Textra is a React Native mobile app that automates SMS-based group coordination for recurring tasks (like chore rotation). Users create groups, add members via phone numbers, set up automated "bots" (functions) that send scheduled reminders, and manage task assignments.

## Tech Stack

### Frontend
- **React Native** with Expo
- **TypeScript**
- Expo Router for navigation
- Supabase client for database/auth

### Backend
- **Supabase** (PostgreSQL database + Auth)
- **Supabase Edge Functions** (Deno/TypeScript)
- **Twilio** for SMS/messaging capabilities

### Key Dependencies
- `@supabase/supabase-js` - Database and auth client
- `@react-native-community/datetimepicker` - Time selection
- `expo-linear-gradient` - UI gradients

## Project Structure

```
textra-app/
├── frontend/
│   ├── app/                          # Expo Router screens
│   │   ├── home.tsx                  # Main screen - list of groups
│   │   ├── create-group.tsx          # Create new group with members
│   │   ├── edit-group.tsx            # Edit existing group
│   │   ├── create-bot.tsx            # Create automated function/bot
│   │   └── ...
│   └── lib/
│       ├── supabase.ts               # Supabase client config
│       └── notifications.ts          # SMS notification helpers
│
└── backend/
    └── supabase/
        ├── functions/                # Edge Functions (Deno)
        │   ├── bot-create/          # Creates bot + Twilio conversation
        │   ├── bot-members/         # Manages bot members + Twilio participants
        │   ├── notify-function-added/ # Welcome SMS when function added
        │   └── run-due/             # Scheduled task executor (runs every 1-5 min)
        └── migrations/              # Database schema
```

## Core Concepts

### 1. Groups
- Collections of members (phone numbers + names)
- Created by users to organize who gets notifications
- Members can be app users (with `user_id`) or non-app users (phone only)

### 2. Bots (Functions)
- Automated schedulers that send recurring SMS messages
- Types: Chore Rotation (currently implemented)
- Each bot has:
  - Schedule (timezone, time of day)
  - Members (who receives messages)
  - Chores (tasks to assign)
  - Assignments (member-to-chore mappings with rotation)

### 3. Chore Rotation
- Automatically assigns chores to members in a rotating fashion
- Sends daily SMS with "Today's chores" listing who does what
- After sending, rotates assignments so next day is different
- Members can opt in/out via STOP/START SMS replies

## Database Schema

### Key Tables

**`groups`**
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users) - Owner
- `name` (TEXT) - Group name
- `created_at`, `updated_at`

**`group_members`**
- `id` (UUID, PK)
- `group_id` (UUID, FK)
- `name` (TEXT)
- `phone_number` (TEXT)
- `user_id` (UUID, FK, nullable) - If member has account

**`bots`**
- `id` (UUID, PK)
- `owner_user_id` (TEXT)
- `name` (TEXT)
- `timezone` (TEXT) - e.g., "America/New_York"
- `schedule_time_local` (TEXT) - HH:MM format
- `last_sent_date` (DATE) - Last time message sent (prevents duplicates)
- `conversation_sid` (TEXT) - Twilio Conversation SID
- `is_active` (BOOLEAN)

**`bot_members`**
- `id` (UUID, PK)
- `bot_id` (UUID, FK)
- `display_name` (TEXT)
- `phone_e164` (TEXT) - E.164 format phone number
- `is_opted_in` (BOOLEAN) - Can opt out via SMS

**`chores`**
- `id` (UUID, PK)
- `bot_id` (UUID, FK)
- `title` (TEXT) - Chore description

**`assignments`**
- `id` (UUID, PK)
- `bot_id` (UUID, FK)
- `member_id` (UUID, FK to bot_members)
- `chore_id` (UUID, FK to chores)
- `position_index` (INTEGER) - Rotation order

**`message_log`**
- `id` (UUID, PK)
- `bot_id` (UUID, FK, nullable)
- `twilio_sid` (TEXT) - Twilio message SID
- `to_phone` (TEXT) - Recipient(s)
- `status` (TEXT) - sent/failed
- `body` (TEXT) - Message content
- `created_at`

## Twilio Integration

### Environment Variables (Supabase Secrets)
```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_CONVERSATIONS_SERVICE_SID
TWILIO_SHARED_NUMBER_E164  # e.g., "+15551234567"
```

### Current Messaging Approach
- **Twilio Conversations API** - Creates managed conversations where SMS participants can send/receive
- When bot is created: Creates Twilio Conversation
- When members added: Adds them as SMS participants to conversation
- When scheduled time hits: Posts message to conversation (Twilio fans out to all participants)

### Important Note on Group Messaging
- Native group MMS (where everyone sees each other in one thread on phones) is **NOT supported** by Twilio
- Current setup uses Conversations, which means:
  - Each member gets SMS from the shared Twilio number
  - When they reply, everyone in the conversation sees it
  - BUT: On their phones, it looks like individual 1-on-1 chats, not a group thread
  - Members don't see each other's phone numbers

## How Messages Are Sent

### 1. Welcome Message (notify-function-added)
**Trigger:** When a bot/function is added to a group
**Flow:**
1. Frontend calls `sendFunctionAddedSMS()` in `lib/notifications.ts`
2. Invokes `notify-function-added` edge function
3. Fetches group members from database
4. Normalizes phone numbers to E.164
5. Sends via Twilio (currently attempting group MMS - has issues)
6. Logs to `message_log`

### 2. Scheduled Messages (run-due)
**Trigger:** Supabase Cron (runs every 1-5 minutes)
**Flow:**
1. Checks current UTC time
2. Converts to each bot's local timezone
3. Filters bots where:
   - `schedule_time_local` matches current HH:MM
   - `last_sent_date` ≠ today's local date
   - `is_active = true`
4. For each due bot:
   - Fetches members, chores, assignments
   - Builds message: "Today's chores: • Name — Task"
   - Sends to Twilio Conversation
   - Updates `last_sent_date`
   - Rotates assignments (increments `position_index` modulo N)

## Current Implementation (As of 2025-12-06)

### Messaging Approach: Individual SMS

**Status:** Working

The app now sends individual SMS messages to each group member rather than attempting native group MMS or using Twilio Conversations.

**How it works:**
- When a scheduled message is due, `run-due` sends a separate SMS to each member
- When a function is added to a group, `notify-function-added` sends individual welcome messages
- Each recipient gets their own 1-on-1 message from the Textra number

**Pros:**
- Simple and reliable
- No Twilio API limitations
- Works with any group size
- Lower cost per message

**Cons:**
- No native group interaction
- Each person receives a separate message
- Replies are not shared among group members

### Future Enhancement: Reply Forwarding (Not Yet Implemented)

**Concept:** Create "group chat-like" functionality where member replies are forwarded to all other members with attribution.

**How it would work:**
1. Textra sends reminder to everyone individually (e.g., "Today's chores: Adam — Dishes")
2. Adam replies with a message
3. Textra receives the reply via webhook
4. Textra forwards to all other members: "Adam said, 'xyz'"

**Status:** Not currently working, planned for future development.

### Previous Exploration (2025-12-04)

#### What We Tried

**Attempt 1: Twilio Conversations**
- Used Twilio Conversations API
- One message posted to conversation, Twilio fans out
- **Result:** Messages delivered but appear as individual 1-on-1 chats on phones, not group thread
- Members can reply and everyone sees responses, but UX feels like 1-on-1 chat

**Attempt 2: Group MMS**
- Attempted to send native group MMS using comma-separated phone numbers in `To` field
- **Result:** ERROR 21211 - "Invalid 'To' Phone Number"
- **Root Cause:** Twilio's Programmable Messaging API does NOT support comma-separated recipients for group MMS
- Native group MMS is not supported by Twilio's standard APIs

**Attempt 3: Individual SMS (Current Solution)**
- Modified `run-due` and `notify-function-added` to send individual SMS to each member
- **Result:** Works reliably, no group interaction but messages are delivered

## Alternative Approaches Considered

### Option 1: Individual SMS (Current Implementation ✓)
**Pros:**
- Reliable and simple
- Lowest cost (~$0.0079 per SMS)
- No limits on group size
- No complex Twilio setup required

**Cons:**
- Each person gets separate message
- No native group interaction
- Multiple API calls per scheduled message
- Replies not shared (without additional webhook logic)

**Status:** Currently implemented and working

### Option 2: Twilio Conversations
**Pros:**
- Members can reply and everyone sees responses
- One API call per message
- No group size limit
- Infrastructure already exists (bot-create, bot-members)

**Cons:**
- On phones, appears as individual 1-on-1 chat with bot number, not group thread
- Members don't see each other's numbers
- Requires Conversations API setup and management
- More complex state management

**Status:** Previously implemented, moved away from this approach

### Option 3: In-App Chat
**Pros:**
- Full control over UX
- True group chat experience
- Can add features like read receipts, reactions, etc.
- No SMS costs for messages

**Cons:**
- Significant development effort
- Members must have the app installed
- Requires push notifications setup
- Loses "works via text message" simplicity

**Status:** Potential future enhancement

## Key Files Reference

### Frontend
- `frontend/lib/notifications.ts:80-128` - `sendFunctionAddedSMS()` function
- `frontend/app/create-group.tsx:202-331` - Group creation flow

### Backend Edge Functions
- `backend/supabase/functions/run-due/index.ts` - Scheduled message sender
- `backend/supabase/functions/notify-function-added/index.ts` - Welcome message
- `backend/supabase/functions/bot-create/index.ts` - Creates bot + Twilio conversation
- `backend/supabase/functions/bot-members/index.ts` - Syncs members to Twilio conversation

## Important Constraints

1. **10-person MMS limit** - Even if group MMS worked, max 10 recipients
2. **MMS pricing** - ~$0.02 per message vs $0.0079 for SMS
3. **E.164 phone format required** - All phones must be +[country][number]
4. **Timezone handling** - Bot schedules use local timezone, must convert from UTC
5. **Once-per-day sending** - `last_sent_date` prevents duplicate sends
6. **Opt-in/out system** - Members can text STOP/START to toggle `is_opted_in`

## Testing Notes

- **Mock mode** available in edge functions when Twilio credentials not set
- Test with actual phone numbers to verify SMS delivery
- Check Twilio dashboard for message logs and debugging
- Monitor Supabase function logs for errors
- `message_log` table tracks all sends for audit trail

## Environment Setup

### Supabase Secrets Required
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_CONVERSATIONS_SERVICE_SID=ISxxx...
TWILIO_SHARED_NUMBER_E164=+15551234567
```

### Deploy Commands
```bash
# Deploy single function
cd backend/supabase
supabase functions deploy run-due
supabase functions deploy notify-function-added

# Deploy all functions
supabase functions deploy
```

## Common Issues

### Issue: Members getting individual texts instead of group chat
**Cause:** Using individual SMS (current implementation)
**Solution:** This is expected behavior - current design sends individual messages. For group-like interaction, implement reply forwarding webhook (planned feature)

### Issue: Messages sending multiple times per day
**Cause:** `last_sent_date` not updating or timezone mismatch
**Solution:** Check bot's timezone and verify date comparison logic

### Issue: Members not receiving messages
**Cause:** Phone number format, opt-out status, or Twilio config
**Solution:** Check `phone_e164` format, `is_opted_in` flag, verify Twilio credentials

## Additional Resources

- Twilio Conversations API: https://www.twilio.com/docs/conversations
- Twilio Programmable Messaging: https://www.twilio.com/docs/messaging
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- React Native + Expo: https://docs.expo.dev/

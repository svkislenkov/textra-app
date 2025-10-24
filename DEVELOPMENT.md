# Textra Development Guide

## Quick Start (Without Twilio)

You can develop and test the full app workflow without Twilio credentials. The backend will automatically run in **mock mode** when Twilio credentials are not set.

### 1. Start the Backend

```bash
cd backend/supabase
supabase start
```

This will:
- Create and migrate the PostgreSQL database
- Start the local API server on port 54321
- Start Edge Functions runtime
- Print connection details

**First time setup:** The migration will automatically create all required tables:
- `bots` - Bot/household configurations
- `bot_members` - Household members with phone numbers
- `chores` - List of chores for each bot
- `assignments` - Current chore-to-member mappings
- `message_log` - Audit trail of sent messages

### 2. Start the Frontend

```bash
cd frontend
npm install  # First time only
npx expo start
```

Then press:
- `w` - Open in web browser
- `i` - Open iOS simulator (requires Xcode)
- `a` - Open Android emulator (requires Android Studio)

### 3. Test the Workflow

1. **Create Bot** - Enter house name, schedule time (e.g., "09:00")
2. **Add Members** - Add names and phone numbers (use fake numbers like "+15551234567")
3. **Add Chores** - List tasks like "Dishes", "Laundry", "Vacuuming"
4. **Send Test** - Click to trigger a test message

In mock mode, you'll see console output in the Supabase logs instead of actual SMS:

```bash
# View Edge Function logs
supabase functions logs --all
```

You'll see:
```
[MOCK MODE] Created fake conversation: CH1234...
[MOCK MODE] Would add 3 participants to conversation CH1234...
[MOCK MODE]   - Alice (+15551111111)
[MOCK MODE]   - Bob (+15552222222)
[MOCK MODE] Would send to conversation CH1234:
Our House — Today's chores:
• Alice — Dishes
• Bob — Laundry
...
```

---

## Database Access

### View Data Locally

Access the local database:
```bash
cd backend/supabase
supabase db studio
```

Opens Supabase Studio at http://localhost:54323

### Query Database Directly

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres
```

Example queries:
```sql
-- View all bots
SELECT * FROM bots;

-- View members for a bot
SELECT * FROM bot_members WHERE bot_id = 'your-bot-id';

-- View current assignments
SELECT
  m.display_name,
  c.title,
  a.position_index
FROM assignments a
JOIN bot_members m ON a.member_id = m.id
JOIN chores c ON a.chore_id = c.id
WHERE a.bot_id = 'your-bot-id'
ORDER BY a.position_index;
```

---

## Architecture

### Mock Mode vs. Real Mode

The Edge Functions automatically detect Twilio credentials:

```typescript
const MOCK_MODE = !Deno.env.get("TWILIO_ACCOUNT_SID");
```

**Mock Mode (default):**
- No Twilio API calls
- Generates fake conversation/message SIDs
- Logs all operations to console
- Database still works normally

**Real Mode (when Twilio configured):**
- Creates real Twilio Conversations
- Adds SMS participants
- Sends actual SMS messages

### Modified Functions

Three Edge Functions support mock mode:
- `bot-create` - Creates fake conversation SID
- `bot-members` - Logs participants instead of adding to Twilio
- `send-test` - Logs message content instead of sending SMS

---

## Adding Twilio (Production)

When you're ready to test with real SMS:

### 1. Get Twilio Credentials

From your Twilio Console (https://console.twilio.com):
- **Account SID** (starts with `AC...`)
- **Auth Token**
- **Conversations Service SID** (starts with `IS...`)
- **Phone Number** (E.164 format, e.g., `+15551234567`)

### 2. Set Environment Variables

```bash
cd backend/supabase
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_CONVERSATIONS_SERVICE_SID=ISxxxxx
supabase secrets set TWILIO_SHARED_NUMBER_E164=+15551234567
```

**For local development**, create `.env.local`:
```bash
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_CONVERSATIONS_SERVICE_SID=ISxxxxx
TWILIO_SHARED_NUMBER_E164=+15551234567
```

### 3. Restart Functions

```bash
supabase functions serve --env-file .env.local
```

The functions will automatically switch to **real mode** and send actual SMS messages.

---

## Troubleshooting

### Database doesn't exist
```bash
cd backend/supabase
supabase db reset  # Resets and re-runs migrations
```

### Functions not responding
Check if Supabase is running:
```bash
supabase status
```

Restart if needed:
```bash
supabase stop
supabase start
```

### Frontend can't connect
Verify the backend URL in `frontend/.env`:
```bash
EXPO_PUBLIC_FUNCS_URL=http://localhost:54321/functions/v1
```

### View Edge Function errors
```bash
supabase functions logs send-test
supabase functions logs bot-create
supabase functions logs bot-members
```

---

## Project Structure

```
textra-app/
├── backend/
│   └── supabase/
│       ├── functions/           # Edge Functions (serverless)
│       │   ├── bot-create/     # Create bot + Twilio conversation
│       │   ├── bot-members/    # Add members to bot + Twilio
│       │   ├── bot-chores/     # Define chores + create assignments
│       │   ├── send-test/      # Manual test message
│       │   ├── run-due/        # Scheduled daily sender
│       │   └── twilio-inbound/ # SMS reply webhook (STOP/START)
│       ├── migrations/          # Database schema
│       └── config.toml          # Supabase configuration
│
└── frontend/
    ├── app/                     # Expo Router pages
    │   ├── index.tsx           # CreateBot screen
    │   ├── members.tsx         # Members screen
    │   ├── chores.tsx          # Chores screen
    │   └── preview.tsx         # Test/Preview screen
    ├── components/              # Reusable UI components
    └── .env                     # Backend URL config
```

---

## Next Steps for Production

1. **Deploy Backend:**
   ```bash
   supabase link --project-ref your-project
   supabase db push
   supabase functions deploy
   ```

2. **Update Frontend:**
   Edit `frontend/.env`:
   ```bash
   EXPO_PUBLIC_FUNCS_URL=https://your-project.supabase.co/functions/v1
   ```

3. **Set Production Secrets:**
   ```bash
   supabase secrets set --env-file .env.production
   ```

4. **Build Mobile Apps:**
   ```bash
   cd frontend
   eas build --platform ios
   eas build --platform android
   ```

---

## Development Tips

- **Check logs frequently:** `supabase functions logs --all`
- **Reset database when schema changes:** `supabase db reset`
- **Test on real device:** Use Expo Go app with QR code
- **Mock mode is safe:** No SMS charges, no Twilio account needed
- **Database persists:** Data survives `supabase stop/start` cycles

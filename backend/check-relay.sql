-- Check recent relay messages (bot_id is NULL for relay messages)
SELECT
  id,
  bot_id,
  group_id,
  to_phone,
  body,
  status,
  error,
  sent_at
FROM message_log
WHERE bot_id IS NULL
ORDER BY sent_at DESC
LIMIT 10;

-- Check all recent messages
SELECT
  id,
  bot_id,
  group_id,
  to_phone,
  body,
  status,
  error,
  sent_at
FROM message_log
ORDER BY sent_at DESC
LIMIT 20;

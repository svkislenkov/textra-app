-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function to call the run-due edge function
CREATE OR REPLACE FUNCTION trigger_run_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_role_key text;
  supabase_url text;
  request_id bigint;
BEGIN
  -- Get environment variables (these should be set in your Supabase project)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Make HTTP request to run-due edge function using http extension
  -- Note: This requires the http extension to be enabled
  SELECT http_post(
    supabase_url || '/functions/v1/run-due',
    '',
    'application/json',
    ARRAY[
      http_header('Authorization', 'Bearer ' || service_role_key)
    ]::http_header[]
  ) INTO request_id;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail
  RAISE WARNING 'Error calling run-due function: %', SQLERRM;
END;
$$;

-- Schedule the cron job to run every minute
-- This will check for due notifications every minute
SELECT cron.schedule(
  'check-due-notifications',
  '* * * * *',  -- Every minute
  'SELECT trigger_run_due();'
);

-- Alternative: If you want it to run every 5 minutes instead:
-- SELECT cron.schedule(
--   'check-due-notifications',
--   '*/5 * * * *',  -- Every 5 minutes
--   'SELECT trigger_run_due();'
-- );

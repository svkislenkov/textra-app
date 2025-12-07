/**
 * Send SMS notifications when a function is added to a group
 */
export async function sendFunctionAddedSMS(
  groupId: string,
  functionName: string,
  functionDetails?: string
): Promise<void> {
  try {
    const base = process.env.EXPO_PUBLIC_FUNCS_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!base) {
      console.error('EXPO_PUBLIC_FUNCS_URL not configured');
      return;
    }

    if (!anonKey) {
      console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY not configured');
      return;
    }

    const response = await fetch(`${base}/notify-function-added`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        groupId,
        functionName,
        functionDetails,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SMS notification failed: ${errorText}`);
    }

    const result = await response.json();
    console.log(`SMS notifications sent: ${result.sent}/${result.total}`);

    if (result.error) {
      console.warn('SMS notification error:', result.error);
    }
  } catch (error) {
    console.error('Error sending SMS notifications:', error);
    throw error;
  }
}

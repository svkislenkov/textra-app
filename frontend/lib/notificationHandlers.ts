import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { scheduleNotificationsForBot } from './notificationScheduler';

/**
 * Handle notification received while app is foregrounded
 */
export function setupNotificationReceivedListener() {
  return Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
    // You can customize behavior here if needed
  });
}

/**
 * Handle notification response (when user taps on notification)
 */
export function setupNotificationResponseListener() {
  return Notifications.addNotificationResponseReceivedListener(async response => {
    const data = response.notification.request.content.data;
    console.log('Notification tapped:', data);

    if (data.type === 'chore_rotation') {
      await handleChoreRotationNotification(
        data.botId as string,
        data.groupId as string,
        data.monthOffset as number | undefined
      );
    }
  });
}

/**
 * Handle chore rotation notification
 * Updates the current_member_index and reschedules the next occurrence
 */
async function handleChoreRotationNotification(
  botId: string,
  groupId: string,
  monthOffset?: number
): Promise<void> {
  try {
    console.log(`[Handler] Notification fired for bot ${botId}, group ${groupId}`);

    // Fetch current bot_group
    const { data: botGroup, error: fetchError } = await supabase
      .from('bot_groups')
      .select('*, bots(*), groups(*)')
      .eq('bot_id', botId)
      .eq('group_id', groupId)
      .single();

    if (fetchError || !botGroup) {
      console.error('Error fetching bot_group:', fetchError);
      return;
    }

    // Fetch group members to calculate new index
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId);

    if (membersError || !members || members.length === 0) {
      console.error('Error fetching members:', membersError);
      return;
    }

    // Calculate new member index
    const currentIndex = botGroup.current_member_index || 0;
    const newIndex = (currentIndex + 1) % members.length;

    // Update the index in database
    const { error: updateError } = await supabase
      .from('bot_groups')
      .update({ current_member_index: newIndex })
      .eq('id', botGroup.id);

    if (updateError) {
      console.error('Error updating current_member_index:', updateError);
      return;
    }

    console.log(`[Handler] Rotated member index from ${currentIndex} to ${newIndex} for bot ${botId}`);

    // Schedule the next notification occurrence
    // Since we removed repeats:true, we must manually schedule the next one
    console.log(`[Handler] Scheduling next occurrence for ${botGroup.bots.frequency} bot`);
    await scheduleNotificationsForBot(botId, groupId);

  } catch (error) {
    console.error('Error handling chore rotation notification:', error);
  }
}

/**
 * Initialize all notification listeners
 * Call this in your app root component
 */
export function initializeNotificationHandlers() {
  const receivedSubscription = setupNotificationReceivedListener();
  const responseSubscription = setupNotificationResponseListener();

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

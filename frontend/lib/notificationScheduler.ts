import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { requestNotificationPermissions, cancelNotifications } from './notificationUtils';

interface Bot {
  id: string;
  name: string;
  function: string;
  type: string;
  frequency: string;
  day_of_week: string | null;
  day_of_month: number | null;
  time: string;
}

interface GroupMember {
  id: string;
  name: string;
  phone_number: string;
}

interface BotGroup {
  id: string;
  bot_id: string;
  group_id: string;
  current_member_index: number;
  notification_ids: string[] | null;
}

/**
 * Calculate notification trigger based on bot frequency and time
 */
function calculateNotificationTrigger(
  frequency: string,
  dayOfWeek: string | null,
  dayOfMonth: number | null,
  timeString: string
): Notifications.NotificationTriggerInput {
  // Parse time from ISO string
  const time = new Date(timeString);
  const hour = time.getHours();
  const minute = time.getMinutes();
  const now = new Date();

  switch (frequency) {
    case 'Daily':
      // Calculate next daily occurrence
      const dailyTarget = new Date();
      dailyTarget.setHours(hour, minute, 0, 0);

      // If the time has already passed today, schedule for tomorrow
      if (dailyTarget <= now) {
        dailyTarget.setDate(dailyTarget.getDate() + 1);
      }

      const secondsFromNow = Math.floor((dailyTarget.getTime() - now.getTime()) / 1000);

      console.log(`[Daily] Scheduling notification for: ${dailyTarget.toLocaleString()}`);
      console.log(`[Daily] Seconds from now: ${secondsFromNow}`);

      return {
        seconds: secondsFromNow,
      };

    case 'Weekly':
      // Convert day name to weekday number (0 = Sunday, 1 = Monday, etc.)
      const dayMap: { [key: string]: number } = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
      };
      const targetWeekday = dayOfWeek ? dayMap[dayOfWeek] : 1; // Default to Monday

      // Calculate next weekly occurrence
      const weeklyTarget = new Date();
      weeklyTarget.setHours(hour, minute, 0, 0);

      const currentWeekday = weeklyTarget.getDay();
      let daysUntilTarget = targetWeekday - currentWeekday;

      // If target day is today but time has passed, or target day is in the past this week
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && weeklyTarget <= now)) {
        daysUntilTarget += 7; // Move to next week
      }

      weeklyTarget.setDate(weeklyTarget.getDate() + daysUntilTarget);

      const weeklySecondsFromNow = Math.floor((weeklyTarget.getTime() - now.getTime()) / 1000);

      console.log(`[Weekly] Scheduling notification for: ${weeklyTarget.toLocaleString()}`);
      console.log(`[Weekly] Seconds from now: ${weeklySecondsFromNow}`);

      return {
        seconds: weeklySecondsFromNow,
      };

    case 'Monthly':
      // Calculate the next monthly occurrence
      const targetDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        dayOfMonth || 1,
        hour,
        minute,
        0,
        0
      );

      // If the target date is in the past, move to next month
      if (targetDate <= now) {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }

      const monthlySecondsFromNow = Math.floor((targetDate.getTime() - now.getTime()) / 1000);

      console.log(`[Monthly] Scheduling notification for: ${targetDate.toLocaleString()}`);
      console.log(`[Monthly] Seconds from now: ${monthlySecondsFromNow}`);

      return {
        seconds: monthlySecondsFromNow,
      };

    default:
      // Default to daily
      const defaultTarget = new Date();
      defaultTarget.setHours(hour, minute, 0, 0);
      if (defaultTarget <= now) {
        defaultTarget.setDate(defaultTarget.getDate() + 1);
      }

      const defaultSecondsFromNow = Math.floor((defaultTarget.getTime() - now.getTime()) / 1000);

      console.log(`[Default] Scheduling notification for: ${defaultTarget.toLocaleString()}`);
      console.log(`[Default] Seconds from now: ${defaultSecondsFromNow}`);

      return {
        seconds: defaultSecondsFromNow,
      };
  }
}

/**
 * Generate rotation message based on bot and member
 */
function generateRotationMessage(
  bot: Bot,
  memberName: string
): string {
  const choreType = bot.type || 'do your task';

  let frequencyText = '';
  switch (bot.frequency) {
    case 'Daily':
      frequencyText = 'turn';
      break;
    case 'Weekly':
      frequencyText = 'week';
      break;
    case 'Monthly':
      frequencyText = 'month';
      break;
    default:
      frequencyText = 'turn';
  }

  return `${memberName}, it's your ${frequencyText} to ${choreType}!`;
}

/**
 * Schedule notifications for a bot assigned to a group
 */
export async function scheduleNotificationsForBot(
  botId: string,
  groupId: string
): Promise<boolean> {
  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission');
      return false;
    }

    // Fetch bot details
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single();

    if (botError || !bot) {
      console.error('Error fetching bot:', botError);
      return false;
    }

    // Fetch group members
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId);

    if (membersError || !members || members.length === 0) {
      console.error('Error fetching members:', membersError);
      return false;
    }

    // Fetch bot_group to get current_member_index
    const { data: botGroup, error: botGroupError } = await supabase
      .from('bot_groups')
      .select('*')
      .eq('bot_id', botId)
      .eq('group_id', groupId)
      .single();

    if (botGroupError || !botGroup) {
      console.error('Error fetching bot_group:', botGroupError);
      return false;
    }

    // Cancel existing notifications for this bot-group combo
    if (botGroup.notification_ids && botGroup.notification_ids.length > 0) {
      await cancelNotifications(botGroup.notification_ids);
    }

    // Calculate trigger
    const trigger = calculateNotificationTrigger(
      bot.frequency,
      bot.day_of_week,
      bot.day_of_month,
      bot.time
    );

    // Get current member
    const currentMemberIndex = botGroup.current_member_index || 0;
    const currentMember = members[currentMemberIndex % members.length];

    // Generate message
    const message = generateRotationMessage(bot, currentMember.name);

    console.log(`[Scheduler] About to schedule notification`);
    console.log(`[Scheduler] Trigger object:`, JSON.stringify(trigger));
    console.log(`[Scheduler] Trigger type:`, typeof trigger);

    // Schedule notification (just ONE - handler will schedule next when it fires)
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: bot.name,
        body: message,
        sound: true,
        data: {
          botId,
          groupId,
          type: 'chore_rotation',
        },
      },
      trigger,
    });

    console.log(`[Scheduler] Notification scheduled with ID: ${notificationId}`);
    console.log(`[Scheduler] Message: "${message}"`);

    // Save notification ID to database (single ID, not array)
    const { error: updateError } = await supabase
      .from('bot_groups')
      .update({ notification_ids: [notificationId] })
      .eq('id', botGroup.id);

    if (updateError) {
      console.error('Error saving notification ID:', updateError);
      return false;
    }

    console.log(`[Scheduler] Successfully scheduled notification for bot ${bot.name}`);
    return true;
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return false;
  }
}

/**
 * Cancel all notifications for a bot-group combination
 */
export async function cancelNotificationsForBot(
  botId: string,
  groupId: string
): Promise<boolean> {
  try {
    // Fetch bot_group to get notification IDs
    const { data: botGroup, error } = await supabase
      .from('bot_groups')
      .select('notification_ids')
      .eq('bot_id', botId)
      .eq('group_id', groupId)
      .single();

    if (error || !botGroup) {
      console.error('Error fetching bot_group:', error);
      return false;
    }

    // Cancel notifications
    if (botGroup.notification_ids && botGroup.notification_ids.length > 0) {
      await cancelNotifications(botGroup.notification_ids);

      // Clear notification IDs from database
      await supabase
        .from('bot_groups')
        .update({ notification_ids: null })
        .eq('bot_id', botId)
        .eq('group_id', groupId);
    }

    return true;
  } catch (error) {
    console.error('Error canceling notifications for bot:', error);
    return false;
  }
}

/**
 * Reschedule all notifications for a group
 * Useful when group members change or bots are updated
 */
export async function rescheduleNotificationsForGroup(groupId: string): Promise<boolean> {
  try {
    // Fetch all bot_groups for this group
    const { data: botGroups, error } = await supabase
      .from('bot_groups')
      .select('bot_id, group_id')
      .eq('group_id', groupId);

    if (error || !botGroups) {
      console.error('Error fetching bot_groups:', error);
      return false;
    }

    // Reschedule each bot
    for (const botGroup of botGroups) {
      await scheduleNotificationsForBot(botGroup.bot_id, botGroup.group_id);
    }

    return true;
  } catch (error) {
    console.error('Error rescheduling notifications for group:', error);
    return false;
  }
}

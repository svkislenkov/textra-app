import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedule a local notification immediately
 */
export async function showLocalNotification(
  title: string,
  body: string
): Promise<void> {
  try {
    // Request permissions first
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      console.log('Notification permission not granted');
      return;
    }

    // Schedule notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // null means show immediately
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

/**
 * Show notification when a function is added to a group
 */
export async function showFunctionAddedNotification(
  functionName?: string
): Promise<void> {
  const title = 'Thanks for registering with Textra!';
  const body = functionName
    ? `${functionName} will now send Textra SMS updates to this group!`
    : 'This group will now receive Textra SMS updates!';

  await showLocalNotification(title, body);
}

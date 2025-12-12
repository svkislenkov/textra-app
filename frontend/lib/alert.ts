import { Alert, Platform } from "react-native";

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
) {
  if (Platform.OS === "web") {
    // Web-compatible implementation
    const buttonText = buttons?.map(b => b.text).join(" / ") || "OK";
    const fullMessage = message ? `${title}\n\n${message}` : title;

    if (buttons && buttons.length > 1) {
      // For multiple buttons, use confirm
      const confirmed = window.confirm(`${fullMessage}\n\nPress OK to ${buttons[buttons.length - 1].text}`);
      if (confirmed && buttons[buttons.length - 1].onPress) {
        buttons[buttons.length - 1].onPress();
      } else if (!confirmed && buttons[0].onPress) {
        buttons[0].onPress();
      }
    } else {
      // For single button, use alert
      window.alert(fullMessage);
      if (buttons?.[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    // Native implementation
    Alert.alert(title, message, buttons);
  }
}

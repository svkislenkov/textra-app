import { Platform, View, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

interface WebTimePickerProps {
  value: Date;
  onChange: (event: any, selectedTime?: Date) => void;
  mode?: "date" | "time" | "datetime" | "countdown";
  is24Hour?: boolean;
  display?: "default" | "spinner" | "compact" | "inline";
  onClose?: () => void;
}

export default function WebTimePicker({
  value,
  onChange,
  mode = "time",
  is24Hour = false,
  display = "default",
  onClose,
}: WebTimePickerProps) {
  if (Platform.OS === "web") {
    // Format time as HH:mm for HTML input
    const hours = value.getHours().toString().padStart(2, "0");
    const minutes = value.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}`;

    const handleWebTimeChange = (e: any) => {
      if (!e.target.value) return;

      const [hours, minutes] = e.target.value.split(":");
      const newDate = new Date(value);
      newDate.setHours(parseInt(hours, 10));
      newDate.setMinutes(parseInt(minutes, 10));

      // Call onChange with the new date
      onChange(e, newDate);
    };

    return (
      <View style={styles.webContainer}>
        <input
          type="time"
          value={timeString}
          onChange={handleWebTimeChange}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.3)",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.5)",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "16px",
            width: "100%",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        />
      </View>
    );
  }

  // Native platforms use the original DateTimePicker
  return (
    <DateTimePicker
      value={value}
      mode={mode}
      is24Hour={is24Hour}
      display={display}
      onChange={onChange}
    />
  );
}

const styles = StyleSheet.create({
  webContainer: {
    width: "100%",
    marginTop: 10,
  },
});

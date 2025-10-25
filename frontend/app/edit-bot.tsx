import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert, SafeAreaView, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function EditBotScreen() {
  const { id } = useLocalSearchParams();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [functionType, setFunctionType] = useState("Chore Rotation");
  const [choreType, setChoreType] = useState("Take out trash");
  const [frequency, setFrequency] = useState("Daily");
  const [dayOfWeek, setDayOfWeek] = useState("Monday");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const functions = ["Chore Rotation"];
  const choreTypes = ["Take out trash", "Clean kitchen", "Clean bathroom"];
  const frequencies = ["Daily", "Weekly", "Monthly"];
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daysOfMonth = Array.from({ length: 28 }, (_, i) => i + 1);

  useEffect(() => {
    fetchBot();
  }, [id]);

  async function fetchBot() {
    if (!id) {
      Alert.alert("Error", "No bot ID provided");
      router.back();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("bots")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        Alert.alert("Error", error.message);
        router.back();
        return;
      }

      if (data) {
        setName(data.name);
        setDescription(data.description);
        setFunctionType(data.function || "Chore Rotation");
        setChoreType(data.type || "Take out trash");
        setFrequency(data.frequency);
        setDayOfWeek(data.day_of_week || "Monday");
        setDayOfMonth(data.day_of_month || 1);
        setTime(new Date(data.time));
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
      console.error(error);
      router.back();
    } finally {
      setFetching(false);
    }
  }

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      setTime(selectedTime);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  async function handleUpdateBot() {
    if (!name.trim() || !description.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("bots")
        .update({
          name: name.trim(),
          description: description.trim(),
          function: functionType,
          type: choreType,
          frequency: frequency,
          day_of_week: frequency === "Weekly" ? dayOfWeek : null,
          day_of_month: frequency === "Monthly" ? dayOfMonth : null,
          time: time.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert("Success", "Bot updated successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBot() {
    Alert.alert(
      "Delete Bot",
      "Are you sure you want to delete this bot?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from("bots")
                .delete()
                .eq("id", id);

              if (error) {
                Alert.alert("Error", error.message);
                return;
              }

              Alert.alert("Success", "Bot deleted successfully!", [
                {
                  text: "OK",
                  onPress: () => router.back(),
                },
              ]);
            } catch (error) {
              Alert.alert("Error", "An unexpected error occurred");
              console.error(error);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  if (fetching) {
    return (
      <LinearGradient
        colors={["#667eea", "#764ba2", "#f093fb"]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading bot...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2", "#f093fb"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Bot</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter bot name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter bot description"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Function</Text>
              <View style={styles.frequencyContainer}>
                {functions.map((func) => (
                  <TouchableOpacity
                    key={func}
                    style={[
                      styles.frequencyButton,
                      functionType === func && styles.frequencyButtonActive,
                    ]}
                    onPress={() => setFunctionType(func)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.frequencyButtonText,
                        functionType === func && styles.frequencyButtonTextActive,
                      ]}
                    >
                      {func}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {functionType === "Chore Rotation" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.frequencyContainer}>
                  {choreTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.frequencyButton,
                        choreType === type && styles.frequencyButtonActive,
                      ]}
                      onPress={() => setChoreType(type)}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.frequencyButtonText,
                          choreType === type && styles.frequencyButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Frequency</Text>
              <View style={styles.frequencyContainer}>
                {frequencies.map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.frequencyButton,
                      frequency === freq && styles.frequencyButtonActive,
                    ]}
                    onPress={() => setFrequency(freq)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.frequencyButtonText,
                        frequency === freq && styles.frequencyButtonTextActive,
                      ]}
                    >
                      {freq}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {frequency === "Weekly" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Day of Week</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.frequencyContainer}>
                    {daysOfWeek.map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.frequencyButton,
                          dayOfWeek === day && styles.frequencyButtonActive,
                        ]}
                        onPress={() => setDayOfWeek(day)}
                        disabled={loading}
                      >
                        <Text
                          style={[
                            styles.frequencyButtonText,
                            dayOfWeek === day && styles.frequencyButtonTextActive,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {frequency === "Monthly" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Day of Month</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.frequencyContainer}>
                    {daysOfMonth.map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayButton,
                          dayOfMonth === day && styles.frequencyButtonActive,
                        ]}
                        onPress={() => setDayOfMonth(day)}
                        disabled={loading}
                      >
                        <Text
                          style={[
                            styles.frequencyButtonText,
                            dayOfMonth === day && styles.frequencyButtonTextActive,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Time</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowTimePicker(!showTimePicker)}
                disabled={loading}
              >
                <Text style={styles.timeText}>{formatTime(time)}</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <View>
                  <DateTimePicker
                    value={time}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.updateButton, loading && styles.buttonDisabled]}
              onPress={handleUpdateBot}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.updateButtonText}>
                {loading ? "Updating..." : "Update Bot"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, loading && styles.buttonDisabled]}
              onPress={handleDeleteBot}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>Delete Bot</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#ffffff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  frequencyContainer: {
    flexDirection: "row",
    gap: 10,
  },
  frequencyButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  frequencyButtonActive: {
    backgroundColor: "#ffffff",
  },
  frequencyButtonText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
  },
  frequencyButtonTextActive: {
    color: "#764ba2",
  },
  dayButton: {
    minWidth: 50,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  timeText: {
    fontSize: 16,
    color: "#ffffff",
  },
  doneButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginTop: 10,
  },
  doneButtonText: {
    color: "#764ba2",
    fontSize: 16,
    fontWeight: "600",
  },
  updateButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: "#764ba2",
    fontSize: 18,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "rgba(255, 59, 48, 0.8)",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 1)",
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

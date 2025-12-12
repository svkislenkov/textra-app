import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { showAlert } from "../lib/alert";

export default function ProfileSetupScreen() {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digit characters
    const cleaned = text.replace(/\D/g, '');

    // Limit to 10 digits
    const limited = cleaned.substring(0, 10);

    // Format as (XXX) XXX-XXXX
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  async function checkPendingInvitations(userId: string, phoneNumber: string) {
    try {
      const { data: invitations } = await supabase
        .from('group_invitations')
        .select('id, groups(name)')
        .eq('invitee_phone_number', phoneNumber)
        .eq('status', 'pending');

      if (invitations && invitations.length > 0) {
        showAlert(
          'Group Invitations',
          `You have ${invitations.length} pending group invitation(s). View them now?`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'View',
              onPress: () => {
                router.back();
                router.push('/pending-invitations');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking pending invitations:', error);
    }
  }

  async function saveProfileData() {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        showAlert("Error", "You must be logged in to set up your profile");
        return;
      }

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from("user_profiles")
          .update({
            name: name.trim(),
            phone_number: phoneNumber.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (error) {
          showAlert("Error", error.message);
          return;
        }
      } else {
        // Create new profile
        const { error } = await supabase
          .from("user_profiles")
          .insert({
            user_id: user.id,
            name: name.trim(),
            phone_number: phoneNumber.trim(),
          });

        if (error) {
          showAlert("Error", error.message);
          return;
        }
      }

      // Check for pending invitations
      await checkPendingInvitations(user.id, phoneNumber.trim());

      showAlert("Success", "Profile saved successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      showAlert("Error", "An unexpected error occurred");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!name.trim() || !phoneNumber.trim()) {
      showAlert("Error", "Please enter both name and phone number");
      return;
    }

    // Check if this is a new profile (user hasn't provided phone number before)
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("phone_number")
        .eq("user_id", user.id)
        .single();

      // Show SMS consent for new users or users without a phone number
      if (!existingProfile || !existingProfile.phone_number) {
        showAlert(
          "SMS Consent",
          "By providing your phone number, you agree to receive SMS reminders/notifications from Textra. Message frequency varies based on the reminders you create. Message and data rates may apply. Reply STOP to opt-out. Reply HELP for help.",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "I Agree",
              onPress: saveProfileData,
            },
          ]
        );
        return;
      }
    }

    // If user already has a phone number, just save without showing consent
    await saveProfileData();
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
            <Text style={styles.title}>Set Up Your Profile</Text>
            <Text style={styles.subtitle}>
              We need your name and phone number to add you to groups
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                editable={!loading}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="(555) 555-5555"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                editable={!loading}
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSaveProfile}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? "Saving..." : "Save Profile"}
              </Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 22,
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 24,
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
  saveButton: {
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
  saveButtonText: {
    color: "#764ba2",
    fontSize: 18,
    fontWeight: "bold",
  },
});

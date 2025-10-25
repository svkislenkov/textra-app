import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

export default function SettingsScreen() {
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || "");
      } else {
        router.replace("/");
      }
    });
  }, []);

  async function handleSignOut() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert("Error", error.message);
      } else {
        router.replace("/");
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const getInitial = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2", "#f093fb"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Settings</Text>

          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.profileContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitial(userEmail)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.emailLabel}>Email</Text>
                <Text style={styles.emailText}>{userEmail}</Text>
              </View>
            </View>
          </View>

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert("Coming Soon", "This feature is not yet implemented")}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert("Coming Soon", "This feature is not yet implemented")}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Privacy Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={() => {
                Alert.alert(
                  "Delete Account",
                  "Are you sure you want to delete your account? This action cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => Alert.alert("Coming Soon", "This feature is not yet implemented")
                    },
                  ]
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionButtonText, styles.dangerText]}>Delete Account</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.signOutButton, loading && styles.buttonDisabled]}
            onPress={handleSignOut}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.signOutButtonText}>
              {loading ? "Signing Out..." : "Sign Out"}
            </Text>
          </TouchableOpacity>
        </View>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 16,
    opacity: 0.9,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#764ba2",
  },
  profileInfo: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  actionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "rgba(255, 59, 48, 0.15)",
    borderColor: "rgba(255, 59, 48, 0.3)",
  },
  dangerText: {
    color: "#ff3b30",
  },
  signOutButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 20,
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
  signOutButtonText: {
    color: "#764ba2",
    fontSize: 18,
    fontWeight: "bold",
  },
});

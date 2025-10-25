import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

export default function HomeScreen() {
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || "");
      } else {
        // If no user, redirect to login
        router.replace("/");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
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

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2", "#f093fb"]}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Textra</Text>
        </View>

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Welcome!</Text>
          <Text style={styles.welcomeSubtitle}>You're signed in as:</Text>
          <Text style={styles.emailText}>{userEmail}</Text>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            This is your home page. More features coming soon!
          </Text>
        </View>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 2,
  },
  welcomeContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  welcomeTitle: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 8,
  },
  emailText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 4,
  },
  infoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  infoText: {
    fontSize: 16,
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 24,
  },
  signOutButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
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

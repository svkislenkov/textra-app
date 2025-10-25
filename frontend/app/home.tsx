import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from "react-native";
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

  const getInitial = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2", "#f093fb"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* User Avatar in Top Right */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitial(userEmail)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.topSection}>
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
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  avatarButton: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#764ba2",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingTop: 100,
  },
  topSection: {
    alignItems: "center",
    marginBottom: 50,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 2,
  },
  welcomeContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 6,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 2,
  },
  infoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  infoText: {
    fontSize: 15,
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 22,
  },
  signOutButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
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

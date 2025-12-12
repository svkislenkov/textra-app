import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

export default function EmailConfirmedScreen() {
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // Check if user is authenticated (which means email was confirmed)
    checkConfirmation();
  }, []);

  async function checkConfirmation() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setConfirmed(true);
      }
    } catch (error) {
      console.error("Error checking confirmation:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    router.replace("/");
  }

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2", "#f093fb"]}
      style={styles.container}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#ffffff" />
        ) : (
          <>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>✓</Text>
            </View>

            <Text style={styles.title}>
              {confirmed ? "Email Confirmed!" : "Confirmation Complete"}
            </Text>

            <Text style={styles.message}>
              {confirmed
                ? "Your email has been successfully verified. You can now sign in to your account."
                : "Thank you for confirming your email. You can now sign in to your account."}
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Continue to Sign In</Text>
            </TouchableOpacity>
          </>
        )}
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
    alignItems: "center",
    padding: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  icon: {
    fontSize: 72,
    color: "#ffffff",
    fontWeight: "bold",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 20,
    textAlign: "center",
  },
  message: {
    fontSize: 18,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 26,
    opacity: 0.95,
  },
  button: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  buttonText: {
    color: "#764ba2",
    fontSize: 18,
    fontWeight: "bold",
  },
});

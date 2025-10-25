import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useCallback } from "react";

interface Bot {
  id: string;
  name: string;
  description: string;
  message: string;
  frequency: string;
  time: string;
}

interface Group {
  id: string;
  name: string;
  member_count?: number;
}

export default function HomeScreen() {
  const [userEmail, setUserEmail] = useState("");
  const [bots, setBots] = useState<Bot[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
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

  const fetchBots = async () => {
    try {
      const { data, error } = await supabase
        .from("bots")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching bots:", error);
        return;
      }

      setBots(data || []);
    } catch (error) {
      console.error("Error fetching bots:", error);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*, group_members(count)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching groups:", error);
        return;
      }

      // Transform the data to include member count
      const groupsWithCount = data.map(group => ({
        id: group.id,
        name: group.name,
        member_count: group.group_members?.[0]?.count || 0,
      }));

      setGroups(groupsWithCount || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBots();
      fetchGroups();
    }, [])
  );

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topSection}>
            <Text style={styles.logoText}>TEXTRA</Text>
          </View>

          {/* Textra Bots Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bots</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/create-bot")}
                activeOpacity={0.7}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {bots.length === 0 ? (
              <View style={styles.sectionContent}>
                <Text style={styles.sectionPlaceholder}>No bots yet</Text>
              </View>
            ) : (
              <View style={styles.botsListContainer}>
                {bots.map((bot) => (
                  <View key={bot.id} style={styles.botCard}>
                    <View style={styles.botCardHeader}>
                      <Text style={styles.botName}>{bot.name}</Text>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => router.push(`/edit-bot?id=${bot.id}`)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.botDescription}>{bot.description}</Text>
                    <View style={styles.botDetails}>
                      <View style={styles.botDetailItem}>
                        <Text style={styles.botDetailLabel}>Frequency:</Text>
                        <Text style={styles.botDetailValue}>{bot.frequency}</Text>
                      </View>
                      <View style={styles.botDetailItem}>
                        <Text style={styles.botDetailLabel}>Time:</Text>
                        <Text style={styles.botDetailValue}>{formatTime(bot.time)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Groups Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Groups</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/create-group")}
                activeOpacity={0.7}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {groups.length === 0 ? (
              <View style={styles.sectionContent}>
                <Text style={styles.sectionPlaceholder}>No groups yet</Text>
              </View>
            ) : (
              <View style={styles.botsListContainer}>
                {groups.map((group) => (
                  <View key={group.id} style={styles.botCard}>
                    <View style={styles.botCardHeader}>
                      <Text style={styles.botName}>{group.name}</Text>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => router.push(`/edit-group?id=${group.id}`)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.botDescription}>
                      {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  topSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 2,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#764ba2",
    lineHeight: 24,
  },
  sectionContent: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionPlaceholder: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    fontStyle: "italic",
  },
  botsListContainer: {
    gap: 12,
  },
  botCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  botCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  botName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    flex: 1,
  },
  editButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  botDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 12,
  },
  botDetails: {
    flexDirection: "row",
    gap: 16,
  },
  botDetailItem: {
    flexDirection: "row",
    gap: 4,
  },
  botDetailLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
  },
  botDetailValue: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "500",
  },
});

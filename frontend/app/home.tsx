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
  function?: string;
  type?: string;
  message_template?: string;
  frequency: string;
  day_of_week?: string;
  day_of_month?: number;
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
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Get current user and check profile
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || "");

        // Check if user has a profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        // If no profile exists, redirect to profile setup
        if (!profile) {
          router.push('/profile-setup');
        }
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

  const fetchPendingInvitationCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .single();

      if (profile?.phone_number) {
        const { count } = await supabase
          .from('group_invitations')
          .select('*', { count: 'exact', head: true })
          .eq('invitee_phone_number', profile.phone_number)
          .eq('status', 'pending');

        setPendingCount(count || 0);
      }
    } catch (error) {
      console.error("Error fetching pending invitations:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBots();
      fetchGroups();
      fetchPendingInvitationCount();
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

  const showHelpMessage = () => {
    // ⚠️ MODIFY THE HELP MESSAGE BELOW ⚠️
    const helpMessage = "First, create a notification you want your group to receive. Next, create a group and apply that notification to it. Messages to that group will then be sent out based on your notification specifications.";
    // ⚠️ END OF MESSAGE TO MODIFY ⚠️

    Alert.alert("How to Use Textra", helpMessage);
  };

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2", "#f093fb"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header with Info and Settings */}
        <View style={styles.header}>
          {/* Info Button in Top Left */}
          <TouchableOpacity
            style={styles.infoButton}
            onPress={showHelpMessage}
            activeOpacity={0.8}
          >
            <View style={styles.infoCircle}>
              <Text style={styles.infoText}>i</Text>
            </View>
          </TouchableOpacity>

          {/* Invitations Button in Center */}
          <TouchableOpacity
            style={styles.invitationsButton}
            onPress={() => router.push("/pending-invitations")}
            activeOpacity={0.8}
          >
            <View style={styles.invitationsContainer}>
              <Text style={styles.invitationsText}>View Invites</Text>
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Settings Gear in Top Right */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
          >
            <View style={styles.settingsCircle}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topSection}>
            <Text style={styles.logoText}>TEXTRA</Text>
          </View>

          {/* Textra Notifications Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notifications</Text>
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
                <Text style={styles.sectionPlaceholder}>No notifications yet</Text>
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
                    <View style={styles.botDetails}>
                      {bot.type && (
                        <View style={styles.botDetailItem}>
                          <Text style={styles.botDetailLabel}>Type:</Text>
                          <Text style={styles.botDetailValue}>{bot.type}</Text>
                        </View>
                      )}
                      <View style={styles.botDetailItem}>
                        <Text style={styles.botDetailLabel}>Frequency:</Text>
                        <Text style={styles.botDetailValue}>{bot.frequency}</Text>
                      </View>
                      {bot.frequency === "Weekly" && bot.day_of_week && (
                        <View style={styles.botDetailItem}>
                          <Text style={styles.botDetailLabel}>Day:</Text>
                          <Text style={styles.botDetailValue}>{bot.day_of_week}</Text>
                        </View>
                      )}
                      {bot.frequency === "Monthly" && bot.day_of_month && (
                        <View style={styles.botDetailItem}>
                          <Text style={styles.botDetailLabel}>Day:</Text>
                          <Text style={styles.botDetailValue}>{bot.day_of_month}</Text>
                        </View>
                      )}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  infoButton: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  infoText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#764ba2",
    fontStyle: "italic",
  },
  settingsButton: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  settingsCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  settingsIcon: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#764ba2",
  },
  invitationsButton: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  invitationsContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invitationsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#764ba2",
  },
  badge: {
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
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
    flexDirection: "column",
    gap: 6,
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

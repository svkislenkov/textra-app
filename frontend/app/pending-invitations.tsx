import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ScrollView, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";

interface Invitation {
  id: string;
  invitee_name: string;
  invited_at: string;
  group: {
    name: string;
  };
  inviter: {
    user_profiles: {
      name: string;
    };
  };
}

export default function PendingInvitationsScreen() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      // Get user's profile to find phone number
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .single();

      if (!profile?.phone_number) {
        Alert.alert('Error', 'User profile not found. Please set up your profile first.');
        return;
      }

      // Fetch pending invitations matching user's phone number
      const { data, error } = await supabase
        .from('group_invitations')
        .select(`
          id,
          invitee_name,
          invited_at,
          groups!inner(name),
          inviter:inviter_user_id(user_profiles!inner(name))
        `)
        .eq('invitee_phone_number', profile.phone_number)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) {
        console.error('Error fetching invitations:', error);
        Alert.alert('Error', 'Failed to load invitations');
        return;
      }

      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInvitations();
    }, [])
  );

  const handleAccept = async (invitation: Invitation) => {
    setProcessingId(invitation.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      // Call accept-group-invitation edge function
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/accept-group-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          invitation_id: invitation.id,
          action: 'accept',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        Alert.alert('Error', result.error || 'Failed to accept invitation');
        return;
      }

      Alert.alert(
        'Success',
        `You've joined ${invitation.group.name}!`,
        [
          {
            text: 'OK',
            onPress: () => fetchInvitations(),
          },
        ]
      );
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitation: Invitation) => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${invitation.group.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              const { data: { session } } = await supabase.auth.getSession();

              if (!session) {
                Alert.alert('Error', 'You must be logged in');
                return;
              }

              // Call accept-group-invitation edge function with decline action
              const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/accept-group-invitation`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                  'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
                },
                body: JSON.stringify({
                  invitation_id: invitation.id,
                  action: 'decline',
                }),
              });

              const result = await response.json();

              if (!response.ok) {
                Alert.alert('Error', result.error || 'Failed to decline invitation');
                return;
              }

              fetchInvitations();
            } catch (error) {
              console.error('Error declining invitation:', error);
              Alert.alert('Error', 'Failed to decline invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2", "#f093fb"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Invitations</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading invitations...</Text>
            </View>
          ) : invitations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No pending invitations</Text>
              <Text style={styles.emptySubtext}>
                When someone invites you to a group, you'll see it here
              </Text>
            </View>
          ) : (
            <View style={styles.invitationsContainer}>
              {invitations.map((invitation) => (
                <View key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.invitationHeader}>
                    <Text style={styles.groupName}>{invitation.group.name}</Text>
                    <Text style={styles.invitedDate}>{formatDate(invitation.invited_at)}</Text>
                  </View>
                  <Text style={styles.inviterText}>
                    Invited by {invitation.inviter?.user_profiles?.name || 'Unknown'}
                  </Text>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.declineButton]}
                      onPress={() => handleDecline(invitation)}
                      disabled={processingId === invitation.id}
                      activeOpacity={0.7}
                    >
                      {processingId === invitation.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>Decline</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.acceptButton]}
                      onPress={() => handleAccept(invitation)}
                      disabled={processingId === invitation.id}
                      activeOpacity={0.7}
                    >
                      {processingId === invitation.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  emptySubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  invitationsContainer: {
    paddingBottom: 20,
  },
  invitationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  invitationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  groupName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  invitedDate: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
  },
  inviterText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 45,
  },
  declineButton: {
    backgroundColor: "rgba(255, 59, 48, 0.8)",
  },
  acceptButton: {
    backgroundColor: "rgba(52, 199, 89, 0.8)",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

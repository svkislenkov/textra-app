import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert, SafeAreaView, ScrollView, Modal, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { showFunctionAddedNotification } from "../lib/notifications";
import { scheduleNotificationsForBot } from "../lib/notificationScheduler";
import * as Contacts from 'expo-contacts';

interface Member {
  id: string;
  name: string;
  phone_number: string;
}

interface Bot {
  id: string;
  name: string;
  description: string;
  function?: string;
  type?: string;
  frequency: string;
}

export default function CreateGroupScreen() {
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  // Manual add state
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Contact picker state
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Bot selection state
  const [availableBots, setAvailableBots] = useState<Bot[]>([]);
  const [selectedBots, setSelectedBots] = useState<Bot[]>([]);
  const [showBotPicker, setShowBotPicker] = useState(false);

  useEffect(() => {
    fetchAvailableBots();
  }, []);

  async function fetchAvailableBots() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error("No user found");
        return;
      }

      const { data, error } = await supabase
        .from("bots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching bots:", error);
        return;
      }

      setAvailableBots(data || []);
    } catch (error) {
      console.error("Error fetching bots:", error);
    }
  }

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

  const handleManualPhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setManualPhone(formatted);
  };

  async function requestContactPermission() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your contacts to import them.');
      return false;
    }
    return true;
  }

  async function openContactPicker() {
    const hasPermission = await requestContactPermission();
    if (!hasPermission) return;

    setLoadingContacts(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        setContacts(data);
        setShowContactPicker(true);
      } else {
        Alert.alert('No Contacts', 'No contacts found on your device.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts');
      console.error(error);
    } finally {
      setLoadingContacts(false);
    }
  }

  function selectContact(contact: Contacts.Contact) {
    if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
      Alert.alert('No Phone Number', 'This contact does not have a phone number.');
      return;
    }

    const phoneNumber = contact.phoneNumbers[0].number || '';
    const name = contact.name || 'Unknown';

    // Check if already added
    if (members.some(m => m.phone_number === phoneNumber)) {
      Alert.alert('Already Added', 'This contact is already in the group.');
      return;
    }

    const newMember: Member = {
      id: Date.now().toString(),
      name,
      phone_number: phoneNumber,
    };

    setMembers([...members, newMember]);
    setShowContactPicker(false);
    setSearchQuery("");
  }

  function addManualMember() {
    if (!manualName.trim() || !manualPhone.trim()) {
      Alert.alert('Error', 'Please enter both name and phone number');
      return;
    }

    // Check if already added
    if (members.some(m => m.phone_number === manualPhone.trim())) {
      Alert.alert('Already Added', 'This phone number is already in the group.');
      return;
    }

    const newMember: Member = {
      id: Date.now().toString(),
      name: manualName.trim(),
      phone_number: manualPhone.trim(),
    };

    setMembers([...members, newMember]);
    setManualName("");
    setManualPhone("");
    setShowManualAdd(false);
  }

  function removeMember(id: string) {
    setMembers(members.filter(m => m.id !== id));
  }

  function addBot(botId: string) {
    // Check if bot is already selected
    if (selectedBots.some(b => b.id === botId)) {
      Alert.alert('Already Added', 'This bot is already assigned to the group.');
      return;
    }

    const bot = availableBots.find(b => b.id === botId);
    if (bot) {
      setSelectedBots([...selectedBots, bot]);
      setShowBotPicker(false);
    }
  }

  function removeBot(id: string) {
    setSelectedBots(selectedBots.filter(b => b.id !== id));
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a group');
        return;
      }

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        Alert.alert(
          'Profile Required',
          'You need to set up your profile before creating a group.',
          [
            {
              text: 'Set Up Profile',
              onPress: () => {
                setLoading(false);
                router.push('/profile-setup');
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setLoading(false),
            },
          ]
        );
        return;
      }

      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          user_id: user.id,
          name: groupName.trim(),
        })
        .select()
        .single();

      if (groupError) {
        Alert.alert('Error', groupError.message);
        return;
      }

      // Add current user as first member
      const memberInserts = [
        {
          group_id: groupData.id,
          name: profile.name,
          phone_number: profile.phone_number,
          user_id: user.id, // Mark this member as the current user
        },
        // Add all other members
        ...members.map(member => ({
          group_id: groupData.id,
          name: member.name,
          phone_number: member.phone_number,
          user_id: null, // Other members don't have a user_id
        })),
      ];

      const { error: membersError } = await supabase
        .from('group_members')
        .insert(memberInserts);

      if (membersError) {
        Alert.alert('Error', membersError.message);
        return;
      }

      // Add bot assignments if any bots are selected
      if (selectedBots.length > 0) {
        const botInserts = selectedBots.map(bot => ({
          bot_id: bot.id,
          group_id: groupData.id,
          current_member_index: 0, // Start with first member
        }));

        const { error: botsError } = await supabase
          .from('bot_groups')
          .insert(botInserts);

        if (botsError) {
          Alert.alert('Error', botsError.message);
          return;
        }

        // Schedule notifications for each bot
        for (const bot of selectedBots) {
          const scheduled = await scheduleNotificationsForBot(bot.id, groupData.id);
          if (!scheduled) {
            console.warn(`Failed to schedule notifications for bot ${bot.name}`);
          }
        }

        // Show notification after successfully adding bots
        await showFunctionAddedNotification();
      }

      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <Text style={styles.title}>Create Group</Text>
          </View>

          <View style={styles.formContainer}>
            {/* Group Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                style={styles.input}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Enter group name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                editable={!loading}
              />
            </View>

            {/* Members Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Members ({members.length})</Text>

              {/* Add Member Buttons */}
              <View style={styles.addButtonsContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={openContactPicker}
                  disabled={loading || loadingContacts}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonText}>
                    {loadingContacts ? 'Loading...' : 'Import from Contacts'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowManualAdd(!showManualAdd)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonText}>
                    {showManualAdd ? 'Cancel' : 'Add Manually'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Manual Add Form */}
              {showManualAdd && (
                <View style={styles.manualAddContainer}>
                  <TextInput
                    style={styles.input}
                    value={manualName}
                    onChangeText={setManualName}
                    placeholder="Name"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  />
                  <TextInput
                    style={[styles.input, styles.inputSpacing]}
                    value={manualPhone}
                    onChangeText={handleManualPhoneChange}
                    placeholder="(555) 555-5555"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity
                    style={styles.addMemberButton}
                    onPress={addManualMember}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addMemberButtonText}>Add Member</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Members List */}
              {members.length > 0 && (
                <View style={styles.membersListContainer}>
                  {members.map(member => (
                    <View key={member.id} style={styles.memberCard}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberPhone}>{member.phone_number}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeMemberButton}
                        onPress={() => removeMember(member.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeMemberButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {members.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No members added yet</Text>
                </View>
              )}
            </View>

            {/* Functions Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Functions ({selectedBots.length})</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowBotPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Bots List */}
              {selectedBots.length > 0 && (
                <View style={styles.botsListContainer}>
                  {selectedBots.map((bot) => (
                    <View key={bot.id} style={styles.botCard}>
                      <View style={styles.botInfo}>
                        <Text style={styles.botName}>{bot.name}</Text>
                        <Text style={styles.botDetails}>
                          {bot.function && `${bot.function} - `}
                          {bot.type && `${bot.type} - `}
                          {bot.frequency}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeBotButton}
                        onPress={() => removeBot(bot.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeBotButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {selectedBots.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No functions assigned yet</Text>
                </View>
              )}
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleCreateGroup}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.createButtonText}>
                {loading ? 'Creating...' : 'Create Group'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Contact Picker Modal */}
        <Modal
          visible={showContactPicker}
          animationType="slide"
          onRequestClose={() => setShowContactPicker(false)}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2", "#f093fb"]}
            style={styles.container}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowContactPicker(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Contact</Text>
                <View style={{ width: 60 }} />
              </View>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search contacts..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>

              <FlatList
                data={filteredContacts}
                keyExtractor={(item) => item.id || ''}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => selectContact(item)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.contactName}>{item.name || 'Unknown'}</Text>
                      {item.phoneNumbers && item.phoneNumbers.length > 0 && (
                        <Text style={styles.contactPhone}>
                          {item.phoneNumbers[0].number}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No contacts found</Text>
                  </View>
                }
              />
            </SafeAreaView>
          </LinearGradient>
        </Modal>

        {/* Function Picker Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={showBotPicker}
          onRequestClose={() => setShowBotPicker(false)}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2", "#f093fb"]}
            style={styles.container}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select a Function</Text>
                <TouchableOpacity onPress={() => setShowBotPicker(false)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={availableBots}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => addBot(item.id)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>
                        {item.function && `${item.function} - `}
                        {item.type && `${item.type} - `}
                        {item.frequency}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No functions available</Text>
                  </View>
                }
              />
            </SafeAreaView>
          </LinearGradient>
        </Modal>
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
  inputSpacing: {
    marginTop: 12,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
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
  addButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  manualAddContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  addMemberButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  addMemberButtonText: {
    color: "#764ba2",
    fontSize: 14,
    fontWeight: "600",
  },
  membersListContainer: {
    gap: 10,
  },
  memberCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  memberPhone: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  removeMemberButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 59, 48, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeMemberButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  emptyStateText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    fontStyle: "italic",
  },
  createButton: {
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
  createButtonText: {
    color: "#764ba2",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  modalCloseText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600",
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  contactItem: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
  },
  botsListContainer: {
    gap: 10,
    marginBottom: 16,
  },
  botCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  botInfo: {
    flex: 1,
  },
  botName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  botDetails: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
  },
  removeBotButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 59, 48, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeBotButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    lineHeight: 20,
  },
});

import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert, SafeAreaView, ScrollView, Modal, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import * as Contacts from 'expo-contacts';

interface Member {
  id: string;
  name: string;
  phone_number: string;
}

export default function EditGroupScreen() {
  const { id } = useLocalSearchParams();
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Manual add state
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Contact picker state
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    fetchGroup();
  }, [id]);

  async function fetchGroup() {
    if (!id) {
      Alert.alert("Error", "No group ID provided");
      router.back();
      return;
    }

    try {
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) {
        Alert.alert('Error', groupError.message);
        router.back();
        return;
      }

      if (groupData) {
        setGroupName(groupData.name);
      }

      // Fetch group members
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', id);

      if (membersError) {
        console.error('Error fetching members:', membersError);
      } else {
        setMembers(membersData || []);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error(error);
      router.back();
    } finally {
      setFetching(false);
    }
  }

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
      id: 'temp_' + Date.now().toString(),
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
      id: 'temp_' + Date.now().toString(),
      name: manualName.trim(),
      phone_number: manualPhone.trim(),
    };

    setMembers([...members, newMember]);
    setManualName("");
    setManualPhone("");
    setShowManualAdd(false);
  }

  function removeMember(memberId: string) {
    setMembers(members.filter(m => m.id !== memberId));
  }

  async function handleUpdateGroup() {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (members.length === 0) {
      Alert.alert('Error', 'Please add at least one member to the group');
      return;
    }

    setLoading(true);

    try {
      // Update group name
      const { error: groupError } = await supabase
        .from('groups')
        .update({
          name: groupName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (groupError) {
        Alert.alert('Error', groupError.message);
        return;
      }

      // Delete all existing members
      const { error: deleteError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', id);

      if (deleteError) {
        console.error('Error deleting members:', deleteError);
      }

      // Add all current members
      const memberInserts = members.map(member => ({
        group_id: id,
        name: member.name,
        phone_number: member.phone_number,
      }));

      const { error: membersError } = await supabase
        .from('group_members')
        .insert(memberInserts);

      if (membersError) {
        Alert.alert('Error', membersError.message);
        return;
      }

      Alert.alert('Success', 'Group updated successfully!', [
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

  async function handleDeleteGroup() {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This will also remove all members.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', id);

              if (error) {
                Alert.alert('Error', error.message);
                return;
              }

              Alert.alert('Success', 'Group deleted successfully!', [
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
          },
        },
      ]
    );
  }

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (fetching) {
    return (
      <LinearGradient
        colors={["#667eea", "#764ba2", "#f093fb"]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading group...</Text>
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
            <Text style={styles.title}>Edit Group</Text>
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
                    onChangeText={setManualPhone}
                    placeholder="Phone Number"
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

            {/* Update Button */}
            <TouchableOpacity
              style={[styles.updateButton, loading && styles.buttonDisabled]}
              onPress={handleUpdateGroup}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.updateButtonText}>
                {loading ? 'Updating...' : 'Update Group'}
              </Text>
            </TouchableOpacity>

            {/* Delete Button */}
            <TouchableOpacity
              style={[styles.deleteButton, loading && styles.buttonDisabled]}
              onPress={handleDeleteGroup}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>Delete Group</Text>
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
  sectionLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
  },
  addButtonsContainer: {
    flexDirection: "row",
    gap: 12,
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
});

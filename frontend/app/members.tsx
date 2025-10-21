import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, Button, FlatList, Alert } from "react-native";
export default function Members() {
  const { botId, botName } = useLocalSearchParams<{ botId: string; botName: string }>();
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [members, setMembers] = useState<{ display_name: string; phone_e164: string }[]>([]);
  const base = process.env.EXPO_PUBLIC_FUNCS_URL!;
  const add = () => { if (!name || !phone) return; setMembers([...members, { display_name: name, phone_e164: phone }]); setName(""); setPhone(""); };
  async function saveMembers() {
    try {
      const r = await fetch(`${base}/bot-members`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ botId, members }) });
      if (!r.ok) throw new Error(await r.text());
      router.push({ pathname: "/chores", params: { botId, botName } });
    } catch (e:any) { Alert.alert("Save failed", String(e)); }
  }
  return (
    <View style={{ padding:20, gap:12 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>{botName}: Members</Text>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="+15551234567" value={phone} onChangeText={setPhone} />
      <Button title="Add" onPress={add} />
      <FlatList data={members} keyExtractor={(i,idx)=>i.phone_e164+idx} renderItem={({item}) => (<Text>• {item.display_name} — {item.phone_e164}</Text>)} />
      <Button title="Next: Chores" onPress={saveMembers} />
    </View>
  );
}
const styles = { input: { borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 } } as const;

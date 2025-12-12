import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, Button, FlatList } from "react-native";
import { showAlert } from "../lib/alert";
export default function Chores() {
  const { botId, botName } = useLocalSearchParams<{ botId: string; botName: string }>();
  const [title, setTitle] = useState(""); const [chores, setChores] = useState<{ title: string }[]>([]);
  const base = process.env.EXPO_PUBLIC_FUNCS_URL!;
  const add = () => { if (!title) return; setChores([...chores, { title }]); setTitle(""); };
  async function saveChores() {
    try {
      const r = await fetch(`${base}/bot-chores`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ botId, chores }) });
      if (!r.ok) throw new Error(await r.text());
      router.push({ pathname: "/preview", params: { botId, botName } });
    } catch (e:any) { showAlert("Save failed", String(e)); }
  }
  return (
    <View style={{ padding:20, gap:12 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>{botName}: Chores</Text>
      <TextInput style={styles.input} placeholder="Chore (e.g., Dishes)" value={title} onChangeText={setTitle} />
      <Button title="Add" onPress={add} />
      <FlatList data={chores} keyExtractor={(i,idx)=>i.title+idx} renderItem={({item}) => (<Text>• {item.title}</Text>)} />
      <Button title="Next: Preview" onPress={saveChores} />
    </View>
  );
}
const styles = { input: { borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 } } as const;

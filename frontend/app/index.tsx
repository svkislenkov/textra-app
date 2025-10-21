import { useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { router } from "expo-router";
import * as Localization from "expo-localization";
export default function CreateBot() {
  const [name, setName] = useState("Our House");
  const [time, setTime] = useState("09:00");
  const tz = Localization.timezone || "America/Detroit";
  const base = process.env.EXPO_PUBLIC_FUNCS_URL!;
  async function onCreate() {
    try {
      const res = await fetch(`${base}/bot-create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, timezone: tz, schedule_time_local: time, owner_user_id: "demo-user" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const bot = await res.json();
      router.push({ pathname: "/members", params: { botId: bot.id, botName: bot.name } });
    } catch (e:any) { Alert.alert("Create failed", String(e)); }
  }
  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Create your bot</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="House name" />
      <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM (24h)" />
      <Text>Timezone: {tz}</Text>
      <Button title="Next: Members" onPress={onCreate} />
    </View>
  );
}
const styles = { input: { borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 } } as const;

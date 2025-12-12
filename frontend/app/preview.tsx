import { useLocalSearchParams } from "expo-router";
import { View, Text, Button } from "react-native";
import { showAlert } from "../lib/alert";
export default function Preview() {
  const { botId, botName } = useLocalSearchParams<{ botId: string; botName: string }>();
  const base = process.env.EXPO_PUBLIC_FUNCS_URL!;
  async function sendTest() {
    try {
      const r = await fetch(`${base}/send-test`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ botId }) });
      if (!r.ok) throw new Error(await r.text());
      const out = await r.json();
      showAlert("Sent", `${out.sent} messages queued`);
    } catch (e:any) { Alert.alert("Send failed", String(e)); }
  }
  return (
    <View style={{ padding:20, gap:14 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>{botName}: Preview</Text>
      <Text>• After saving members & chores, tap Send Test to try a real SMS.{"\n"}• Daily sends happen automatically.</Text>
      <Button title="Send Test" onPress={sendTest} />
    </View>
  );
}

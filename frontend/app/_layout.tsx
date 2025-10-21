import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
export default function Root() {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <Stack screenOptions={{ headerTitle: "Textra", headerShadowVisible: false }} />
    </QueryClientProvider>
  );
}

import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { initializeNotificationHandlers } from "../lib/notificationHandlers";

export default function Root() {
  const [qc] = useState(() => new QueryClient());

  useEffect(() => {
    // Initialize notification handlers on app launch
    const cleanup = initializeNotificationHandlers();

    // Cleanup listeners when app unmounts
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}

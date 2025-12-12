import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Platform } from "react-native";

export default function Root() {
  const [qc] = useState(() => new QueryClient());

  useEffect(() => {
    // Add web-specific styles for better interactions
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        /* Make touchable elements show pointer cursor on web */
        [role="button"],
        button,
        input[type="button"],
        input[type="submit"],
        input[type="time"] {
          cursor: pointer !important;
        }

        /* Ensure text inputs show text cursor */
        input[type="text"],
        input[type="email"],
        input[type="password"],
        textarea {
          cursor: text !important;
        }

        /* Fix input styling for time picker */
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }

        /* Smooth transitions for interactive elements */
        [role="button"],
        button {
          transition: opacity 0.2s ease;
        }

        [role="button"]:active,
        button:active {
          opacity: 0.7;
        }

        /* Fix scrolling on web */
        body {
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* Better touch target styles */
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}

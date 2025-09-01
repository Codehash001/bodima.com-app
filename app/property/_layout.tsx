import { Stack } from 'expo-router';
import React from 'react';

export default function PropertyStack() {
  return (
    <Stack screenOptions={{
      headerBackTitle: 'Home',
      headerTitle: '',
      headerTransparent: true,
    }}>
      <Stack.Screen name="[id]" options={{
        // Ensure the back title shows as Home and no title is displayed
        headerBackTitle: 'Home',
        headerTitle: '',
        headerTransparent: true,
      }} />
    </Stack>
  );
}

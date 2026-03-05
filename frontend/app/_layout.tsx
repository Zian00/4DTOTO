import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';

import { Colors } from '../constants/theme';
import { getNickname, setNickname } from '../utils/deviceId';
import { WelcomeModal } from '../components/WelcomeModal';

export default function RootLayout() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    getNickname().then((name) => {
      if (!name) setShowWelcome(true);
    });
  }, []);

  function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Please enter a name');
      return;
    }
    setNickname(trimmed);
    setShowWelcome(false);
  }

  return (
    <>
      <Stack
        screenOptions={{
          statusBarStyle: 'light',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="ticket/[id]"
          options={{
            title: 'Ticket Detail',
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: '#fff',
            headerBackVisible: false,
            headerLeft: () => null,
          }}
        />
      </Stack>

      <Toast />

      {showWelcome && (
        <WelcomeModal
          nameInput={nameInput}
          onChangeName={setNameInput}
          onSave={handleSaveName}
          onSkip={() => setShowWelcome(false)}
        />
      )}
    </>
  );
}

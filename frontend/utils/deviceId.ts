import AsyncStorage from '@react-native-async-storage/async-storage';

const NICKNAME_KEY = '@fourdtoto/nickname';

export async function getNickname(): Promise<string | null> {
  return AsyncStorage.getItem(NICKNAME_KEY);
}

export async function setNickname(name: string): Promise<void> {
  await AsyncStorage.setItem(NICKNAME_KEY, name.trim());
}

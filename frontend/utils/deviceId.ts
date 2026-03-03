import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@fourdtoto/device_id';
const NICKNAME_KEY = '@fourdtoto/nickname';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getNickname(): Promise<string | null> {
  return AsyncStorage.getItem(NICKNAME_KEY);
}

export async function setNickname(name: string): Promise<void> {
  await AsyncStorage.setItem(NICKNAME_KEY, name.trim());
}

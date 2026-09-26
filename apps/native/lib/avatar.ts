import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";

// プロフィール写真はまだサーバーに上げず、この端末にだけ保存する。
// 画像のアップロード先ができたら user.image に置き換える。

const key = (userId: string) => `ichiro.avatar.${userId}`;

let current: string | null = null;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function emit(uri: string | null) {
  current = uri;
  listeners.forEach((l) => l());
}

async function read(userId: string) {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(key(userId)).catch(() => null);
}

async function write(userId: string, uri: string | null) {
  if (Platform.OS === "web") return;
  if (uri) await SecureStore.setItemAsync(key(userId), uri);
  else await SecureStore.deleteItemAsync(key(userId));
}

export function useAvatar(userId: string | undefined) {
  const uri = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );

  useEffect(() => {
    if (!userId || loadedFor === userId) return;
    loadedFor = userId;
    emit(null);
    read(userId).then((v) => {
      if (loadedFor === userId) emit(v);
    });
  }, [userId]);

  const pick = useCallback(async () => {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    emit(asset.uri);
    await write(userId, asset.uri);
  }, [userId]);

  const remove = useCallback(async () => {
    if (!userId) return;
    emit(null);
    await write(userId, null);
  }, [userId]);

  return { uri, pick, remove };
}

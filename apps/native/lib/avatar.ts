import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Alert, Image, Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

import { ENV } from "../src/env";

// プロフィール写真はサーバー（Cloudflare R2）に上げて、user.image にそのパスを入れる。
// 表示サイズは最大でも数十ピクセルなので、上げる前に 512px 四方の JPEG に縮める。
const UPLOAD_SIZE = 512;

// user.image はサーバーからの相対パス。外部の URL ならそのまま使う
export function avatarUrl(image: string | null | undefined) {
  if (!image) return null;
  if (/^https?:\/\//.test(image)) return image;
  return `${ENV.EXPO_PUBLIC_SERVER_URL.replace(/\/$/, "")}${image}`;
}

async function request(method: "PUT" | "DELETE", body?: ArrayBuffer) {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "image/jpeg";
  if (Platform.OS !== "web") {
    // Better Auth Expo はネイティブではセッションの Cookie を手で付ける
    const cookie = await authClient.getCookie();
    if (cookie) headers.Cookie = cookie;
  }
  const res = await fetch(`${ENV.EXPO_PUBLIC_SERVER_URL}/api/profile/avatar`, {
    method,
    body,
    headers,
    credentials: Platform.OS === "web" ? "include" : "omit",
  }).catch(() => {
    throw new Error("通信できませんでした");
  });
  const data = (await res.json().catch(() => null)) as {
    image?: string | null;
    message?: string;
  } | null;
  if (!res.ok) throw new Error(data?.message ?? "通信に失敗しました");
  return data?.image ?? null;
}

function showError(title: string, e: unknown) {
  const message = e instanceof Error ? e.message : undefined;
  // react-native-web の Alert は何も表示しない
  if (Platform.OS === "web") window.alert(message ? `${title}\n${message}` : title);
  else Alert.alert(title, message);
}

// 切り抜き画面がない環境（Web など）でも正方形になるよう、中央を切り抜いてから縮める
async function shrink({ uri, width, height }: ImagePicker.ImagePickerAsset) {
  const side = Math.min(width, height);
  const size = Math.min(side, UPLOAD_SIZE);
  const rendered = await ImageManipulator.manipulate(uri)
    .crop({
      originX: Math.floor((width - side) / 2),
      originY: Math.floor((height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: size, height: size })
    .renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

export function useAvatar() {
  const { data: session, refetch } = authClient.useSession();
  // アップロード中は選んだ写真をすぐに見せる
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const uri = preview ?? avatarUrl(session?.user.image);

  const pick = useCallback(async () => {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setBusy(true);
    try {
      const small = await shrink(asset);
      setPreview(small);
      // iOS の file:// 読み込みは MIME 型が空になることがある。
      // Expo fetch は Blob.type で Content-Type を上書きするため、バイト列で送る。
      const bytes = await (await fetch(small)).arrayBuffer();
      const image = await request("PUT", bytes);
      // 読み込み済みにしてから差し替え、表示が一瞬消えないようにする
      const url = avatarUrl(image);
      if (url) await Image.prefetch(url).catch(() => {});
      await refetch();
    } catch (e) {
      showError("写真を保存できませんでした", e);
    } finally {
      setPreview(null);
      setBusy(false);
    }
  }, [busy, refetch]);

  const remove = useCallback(async () => {
    if (busy || !session?.user.image) return;
    setBusy(true);
    try {
      await request("DELETE");
      await refetch();
    } catch (e) {
      showError("写真を削除できませんでした", e);
    } finally {
      setBusy(false);
    }
  }, [busy, refetch, session?.user.image]);

  return { uri, busy, pick, remove };
}

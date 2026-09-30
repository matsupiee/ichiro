import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";

import { ENV } from "../src/env";

export const legalPages = [
  { id: "terms", title: "利用規約" },
  { id: "commerce", title: "特定商取引法に基づく表記" },
  { id: "privacy", title: "プライバシーポリシー" },
] as const;

let opening = false;

export async function openLegalPage(id: (typeof legalPages)[number]["id"]) {
  if (opening) return;
  opening = true;
  try {
    await WebBrowser.openBrowserAsync(`${ENV.EXPO_PUBLIC_SERVER_URL.replace(/\/$/, "")}/${id}`, {
      dismissButtonStyle: "close",
    });
  } catch {
    Alert.alert("ページを開けませんでした", "時間をおいて、もう一度お試しください。");
  } finally {
    opening = false;
  }
}

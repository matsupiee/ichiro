import { Alert, Linking } from "react-native";

const contactEmail = "btq32jh@icloud.com";
let opening = false;

export async function openContactEmail() {
  if (opening) return;
  opening = true;
  try {
    await Linking.openURL(
      `mailto:${contactEmail}?subject=${encodeURIComponent("ichiro 問い合わせ・報告")}`,
    );
  } catch {
    Alert.alert(
      "メールアプリを開けませんでした",
      `メールアプリの設定をご確認ください。お問い合わせ・報告は ${contactEmail} 宛にお送りいただけます。`,
    );
  } finally {
    opening = false;
  }
}

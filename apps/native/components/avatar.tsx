import { Image, View } from "react-native";

export function Avatar({
  uri,
  size,
  placeholderColor,
}: {
  uri: string | null;
  size: number;
  placeholderColor: string;
}) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: placeholderColor,
      }}
    />
  );
}

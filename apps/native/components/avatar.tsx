import { ActivityIndicator, Image, View } from "react-native";

export function Avatar({
  uri,
  size,
  placeholderColor,
  loading = false,
}: {
  uri: string | null;
  size: number;
  placeholderColor: string;
  loading?: boolean;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[round, { backgroundColor: placeholderColor, overflow: "hidden" }]}>
      {uri ? <Image source={{ uri }} style={round} /> : null}
      {loading ? (
        <View
          style={[
            round,
            {
              position: "absolute",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.45)",
            },
          ]}
        >
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

import type { ReactNode } from "react";
import { ActivityIndicator, Image, View } from "react-native";

export function Avatar({
  uri,
  size,
  placeholderColor,
  loading = false,
  placeholder,
}: {
  uri: string | null;
  size: number;
  placeholderColor: string;
  loading?: boolean;
  placeholder?: ReactNode;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[round, { backgroundColor: placeholderColor, overflow: "hidden" }]}>
      {uri ? (
        <Image source={{ uri }} style={round} />
      ) : (
        <View style={[round, { alignItems: "center", justifyContent: "center" }]}>
          {placeholder}
        </View>
      )}
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

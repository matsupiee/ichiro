import type { ConfigContext, ExpoConfig } from "expo/config";

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const isStaging = process.env.APP_ENV === "stg";
  return {
    ...config,
    name: isStaging ? "[stg] ichiro" : "ichiro",
    slug: "ichiro",
    scheme: isStaging ? "ichiro-stg" : "ichiro",
    ios: {
      ...config.ios,
      bundleIdentifier: isStaging ? "com.anonymous.ichiro.stg" : "com.anonymous.ichiro",
    },
    android: {
      ...config.android,
      package: isStaging ? "com.anonymous.ichiro.stg" : "com.anonymous.ichiro",
    },
  };
}

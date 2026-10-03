const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");
const { withDangerousMod, withXcodeProject, withAndroidManifest } = require("expo/config-plugins");
const expoRequire = createRequire(require.resolve("expo/package.json"));
const { generateImageAsync } = expoRequire("@expo/image-utils");
const icons = ["blue", "purple", "pink"];

async function image(projectRoot, name, size) {
  const { source } = await generateImageAsync(
    { projectRoot, cacheType: "ichiro-app-icons" },
    {
      src: path.join(projectRoot, `assets/images/app-icons/${name}.jpg`),
      width: size,
      height: size,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
  );
  return source;
}

module.exports = function withAppIcons(config) {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      for (const name of icons.filter((name) => name !== "blue")) {
        const dir = path.join(
          platformProjectRoot,
          projectName,
          "Images.xcassets",
          `${name}.appiconset`,
        );
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, "icon.png"), await image(projectRoot, name, 1024));
        await fs.writeFile(
          path.join(dir, "Contents.json"),
          JSON.stringify({
            images: [
              { filename: "icon.png", idiom: "universal", platform: "ios", size: "1024x1024" },
            ],
            info: { version: 1, author: "xcode" },
          }),
        );
      }
      return config;
    },
  ]);
  config = withXcodeProject(config, (config) => {
    for (const value of Object.values(config.modResults.pbxXCBuildConfigurationSection())) {
      if (typeof value === "object" && value.buildSettings?.ASSETCATALOG_COMPILER_APPICON_NAME) {
        value.buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = '"purple pink"';
        value.buildSettings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = "YES";
      }
    }
    return config;
  });
  config = withAndroidManifest(config, (config) => {
    configureAndroidIcons(config.modResults.manifest);
    return config;
  });
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const root = path.join(config.modRequest.platformProjectRoot, "app/src/main/res");
      for (const dir of ["drawable-nodpi", "mipmap-anydpi-v26", "mipmap-mdpi"])
        await fs.mkdir(path.join(root, dir), { recursive: true });
      for (const name of icons) {
        await fs.writeFile(
          path.join(root, "drawable-nodpi", `ichiro_${name}.png`),
          await image(config.modRequest.projectRoot, name, 432),
        );
        await fs.writeFile(
          path.join(root, "mipmap-mdpi", `ichiro_${name}.png`),
          await image(config.modRequest.projectRoot, name, 48),
        );
        await fs.writeFile(
          path.join(root, "mipmap-anydpi-v26", `ichiro_${name}.xml`),
          `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@android:color/white" />
  <foreground><inset android:drawable="@drawable/ichiro_${name}" android:inset="16.67%" /></foreground>
</adaptive-icon>\n`,
        );
      }
      return config;
    },
  ]);
};

function configureAndroidIcons(manifest) {
  const app = manifest.application[0];
  const main = app.activity.find((activity) => activity.$["android:name"] === ".MainActivity");
  if (!main) throw new Error("MainActivity missing");
  const launcher = (filter) =>
    filter.category?.some((c) => c.$["android:name"] === "android.intent.category.LAUNCHER");
  main["intent-filter"] = (main["intent-filter"] ?? []).filter((filter) => !launcher(filter));
  app.$["android:icon"] = "@mipmap/ichiro_blue";
  app.$["android:roundIcon"] = "@mipmap/ichiro_blue";
  app["activity-alias"] = [
    ...(app["activity-alias"] ?? []).filter(
      (alias) => !icons.some((name) => alias.$["android:name"] === `.Icon_${name}`),
    ),
    ...icons.map((name) => ({
      $: {
        "android:name": `.Icon_${name}`,
        "android:targetActivity": ".MainActivity",
        "android:enabled": name === "blue" ? "true" : "false",
        "android:exported": "true",
        "android:icon": `@mipmap/ichiro_${name}`,
        "android:label": "@string/app_name",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
          category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
        },
      ],
    })),
  ];
}

module.exports.configureAndroidIcons = configureAndroidIcons;

const { describe, test, expect } = require("bun:test");
const { configureAndroidIcons } = require("./with-app-icons.cjs");

describe("Android launcher icon configuration", () => {
  test("keeps deep links and MainActivity enabled, exposes only blue initially, and is repeatable", () => {
    const deepLink = {
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      category: [{ $: { "android:name": "android.intent.category.BROWSABLE" } }],
      data: [{ $: { "android:scheme": "ichiro" } }],
    };
    const main = {
      $: { "android:name": ".MainActivity", "android:exported": "true" },
      "intent-filter": [
        { category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }] },
        deepLink,
      ],
    };
    const manifest = { application: [{ $: {}, activity: [main] }] };
    configureAndroidIcons(manifest);
    const once = structuredClone(manifest);
    configureAndroidIcons(manifest);
    expect(manifest).toEqual(once);
    expect(main["intent-filter"]).toEqual([deepLink]);
    expect(main.$["android:enabled"]).not.toBe("false");
    const aliases = manifest.application[0]["activity-alias"];
    expect(aliases).toHaveLength(3);
    expect(
      aliases
        .filter((alias) => alias.$["android:enabled"] === "true")
        .map((alias) => alias.$["android:name"]),
    ).toEqual([".Icon_blue"]);
    for (const alias of aliases) expect(alias.$["android:targetActivity"]).toBe(".MainActivity");
  });
  test("fails the build if the target activity is missing", () => {
    expect(() => configureAndroidIcons({ application: [{ $: {}, activity: [] }] })).toThrow(
      "MainActivity missing",
    );
  });
});

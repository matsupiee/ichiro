import assert from "node:assert/strict";
import { test } from "node:test";

import { createAchievementAnimationChooser } from "./achievement-animation";

test("each pair contains both versions with an equally random starting version", () => {
  for (const value of [0, 0.25, 0.499999, 0.5, 0.75, 0.999999]) {
    let calls = 0;
    const choose = createAchievementAnimationChooser(() => {
      calls++;
      return value;
    });
    const first = choose();
    assert.equal(first, value < 0.5 ? "studying" : "lifting");
    assert.notEqual(choose(), first);
    assert.equal(calls, 1);
    choose();
    assert.equal(calls, 2);
  }
});

test("repeated random values cannot keep selecting one version", () => {
  for (const value of [0, 0.999999]) {
    const choose = createAchievementAnimationChooser(() => value);
    const results = Array.from({ length: 100 }, () => choose());
    assert.equal(results.filter((version) => version === "studying").length, 50);
    assert.equal(results.filter((version) => version === "lifting").length, 50);
  }
});

test("pair boundaries allow repeats but never three of the same version", () => {
  let calls = 0;
  const choose = createAchievementAnimationChooser(() => (calls++ % 2 === 0 ? 0.1 : 0.9));
  const results = Array.from({ length: 100 }, () => choose());
  assert.deepEqual(results.slice(0, 6), [
    "studying",
    "lifting",
    "lifting",
    "studying",
    "studying",
    "lifting",
  ]);
  for (let i = 2; i < results.length; i++) {
    assert.ok(results[i] !== results[i - 1] || results[i] !== results[i - 2]);
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { chooseAchievementAnimation } from "./achievement-animation";

test("the random range is split equally at 0.5", () => {
  for (const value of [0, 0.25, 0.499999]) {
    assert.equal(
      chooseAchievementAnimation(() => value),
      "studying",
    );
  }
  for (const value of [0.5, 0.75, 0.999999]) {
    assert.equal(
      chooseAchievementAnimation(() => value),
      "lifting",
    );
  }
});

test("each report draws once and returns a single version", () => {
  let calls = 0;
  const random = () => (++calls === 1 ? 0.1 : 0.9);
  const firstReport = chooseAchievementAnimation(random);
  assert.equal(calls, 1);
  const secondReport = chooseAchievementAnimation(random);
  assert.equal(calls, 2);
  assert.equal(firstReport, "studying");
  assert.equal(secondReport, "lifting");
});

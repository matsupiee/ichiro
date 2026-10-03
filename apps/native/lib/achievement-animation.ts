export type AchievementAnimation = "lifting" | "studying";

// Shuffle a pair at a time so both versions appear, with at most two repeats
// across pair boundaries. Keep this chooser shared across report screens.
export function createAchievementAnimationChooser(random = Math.random) {
  let remaining: AchievementAnimation | undefined;
  return (): AchievementAnimation => {
    if (remaining) {
      const next = remaining;
      remaining = undefined;
      return next;
    }
    const first = random() < 0.5 ? "studying" : "lifting";
    remaining = first === "studying" ? "lifting" : "studying";
    return first;
  };
}

// Call once per report and retain the result throughout that celebration.
export const chooseAchievementAnimation = createAchievementAnimationChooser();

export type AchievementAnimation = "lifting" | "studying";

// Call once per report; keep the result in the celebration state for its entire lifetime.
export function chooseAchievementAnimation(random = Math.random): AchievementAnimation {
  return random() < 0.5 ? "studying" : "lifting";
}

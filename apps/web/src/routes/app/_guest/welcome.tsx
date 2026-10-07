import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Dog } from "../../../components/dog/dog";
import { BrandLogo, PrimaryLink, Screen, SecondaryLink } from "../../../components/ui";

export const Route = createFileRoute("/app/_guest/welcome")({
  head: () => ({ meta: [{ title: "はじめる | ichiro" }] }),
  component: WelcomeScreen,
});

function WelcomeScreen() {
  const [jumping, setJumping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ワンちゃんを押すと少しのあいだ跳ねる
  const tapDog = () => {
    setJumping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJumping(false), 1600);
  };

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-[30px]">
        <button type="button" aria-label="ワンちゃん" onClick={tapDog} className="rounded-full">
          <Dog size={210} mood={jumping ? "jump" : "idle"} />
        </button>
        <BrandLogo width={230} />
        <p className="text-center text-[16px] leading-[27px] whitespace-pre-line text-mute">
          {"目標を宣言して、毎日の達成を報告しよう。\nがんばった日は、ボクがお祝いするワン。"}
        </p>
      </div>
      <div className="flex flex-col gap-3.5 px-[30px] pb-3">
        <PrimaryLink to="/app/sign-up" label="アカウントを作る" />
        <SecondaryLink to="/app/sign-in" label="ログイン" />
      </div>
    </Screen>
  );
}

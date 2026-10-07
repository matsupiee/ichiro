import { createFileRoute } from "@tanstack/react-router";

import { AuthForm } from "../../../components/auth-form";

export const Route = createFileRoute("/app/_guest/sign-up")({
  head: () => ({ meta: [{ title: "新規登録 | ichiro" }] }),
  component: () => <AuthForm mode="sign-up" />,
});

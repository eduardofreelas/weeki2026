"use client";

import { AuthScreen } from "@/components/weeki/auth-screen";
import { useWeekiAccount } from "@/features/account/use-weeki-account";

export default function LoginPage() {
  return <AuthScreen controller={useWeekiAccount()} initialMode="login" />;
}

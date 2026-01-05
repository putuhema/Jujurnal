"use client";

import { GithubLogoIcon } from "@phosphor-icons/react";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export const SocialLogin = () => {
  const router = useRouter();
  return (
    <Button
      size="sm"
      onClick={async () => {
        await authClient.signIn.social(
          {
            provider: "github",
          },
          {
            onSuccess: () => {
              router.push("/");
            },
          }
        );
      }}
    >
      <GithubLogoIcon />
      Login
    </Button>
  );
};

"use client";

import { GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { Button, buttonVariants } from "./ui/button";
import { authClient } from "@/lib/auth-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const SocialLogin = () => {
  return (
    <Dialog>
      <DialogTrigger className={buttonVariants({ variant: "default" })}>
        Login
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login with</DialogTitle>
          <DialogDescription>Choose a provider to continue</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "github" })}
          >
            <GithubLogoIcon className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "google" })}
          >
            <GoogleLogoIcon className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

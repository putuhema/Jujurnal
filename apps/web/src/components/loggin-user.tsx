"use client";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { SocialLogin } from "./social-login";
import { SignOutIcon, UserIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Skeleton } from "./ui/skeleton";

export const LogginUser = () => {
  const { data } = authClient.useSession();
  const router = useRouter();
  return (
    <>
      <Authenticated>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar size="sm">
              <AvatarImage src={data?.user.image ?? ""} />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => router.push("/profile" as Route<"/profile">)}
            >
              <UserIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/");
                    },
                  },
                });
              }}
              variant="destructive"
            >
              <SignOutIcon />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Authenticated>
      <AuthLoading>
        <Skeleton className="w-7 h-7 rounded-full" />
      </AuthLoading>
      <Unauthenticated>
        <SocialLogin />
      </Unauthenticated>
    </>
  );
};

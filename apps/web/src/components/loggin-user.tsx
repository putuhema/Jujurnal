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

export const LogginUser = () => {
  const { data } = authClient.useSession();

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
            <DropdownMenuItem>
              <UserIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <SignOutIcon />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Authenticated>
      <Unauthenticated>
        <SocialLogin />
      </Unauthenticated>
    </>
  );
};

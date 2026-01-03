"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { useState } from "react";

import UserMenu from "@/components/user-menu";
import { Achievements } from "@/components/achievements";

export default function DashboardPage() {
  const [showSignIn, setShowSignIn] = useState(false);
  const privateData = useQuery(api.privateData.get);

  return (
    <>
      <Authenticated>
        <div className="space-y-6">
          <div>
            <h1>Dashboard</h1>
            <p>privateData: {privateData?.message}</p>
            <UserMenu />
          </div>
          <Achievements />
        </div>
      </Authenticated>
      {/* <Unauthenticated>
      </Unauthenticated> */}
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>
    </>
  );
}

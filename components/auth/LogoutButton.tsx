"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function LogoutButton() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        await signOut();
        router.push("/login");
      }}
      disabled={loading}
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}


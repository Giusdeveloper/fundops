"use client";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Se signOut fallisce lato client, procediamo comunque verso login.
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <button type="button" onClick={handleLogout} className={className}>
      {children}
    </button>
  );
}

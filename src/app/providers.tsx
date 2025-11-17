'use client';

import { AuthProvider } from "@/hooks/useAuth";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PermissionsProvider>
        {children}
        <Toaster />
      </PermissionsProvider>
    </AuthProvider>
  );
}

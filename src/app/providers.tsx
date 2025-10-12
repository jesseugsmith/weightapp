'use client';

import { AuthProvider } from "@/hooks/useAuth";
import { PermissionsProvider } from "@/contexts/PermissionsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PermissionsProvider>
        {children}
      </PermissionsProvider>
    </AuthProvider>
  );
}

'use client';

import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { PermissionProvider } from "@/contexts/PermissionContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PermissionProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </PermissionProvider>
    </AuthProvider>
  );
}

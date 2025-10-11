"use client"

import * as React from "react"
import { useMemo } from "react"
import {
  BookOpen,
  Bot,
  Command,
  Frame,
  HomeIcon,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  Settings2Icon,
  SquareTerminal,
  Scale,
  type LucideIcon,
  CloudLightning,
  Key,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import LogWeightModal from "@/components/LogWeightModal"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { usePermissions } from "@/contexts/PermissionContext"
import { useAuth } from "@/hooks/useAuth"
import { useProfile } from "@/hooks/useProfile"
import pb from "@/lib/pocketbase"
import { usePathname, useRouter } from "next/navigation"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.",
  },
  navMain: [
    {
      title: "Home",
      url: "/home",
      icon: HomeIcon,
      isActive: true,
      items: [],
    },
    {
      title: "Competitions",
      url: "/competitions",
      icon: Bot,
      items: [],
    },
    
  ],
  navSecondary: [],
  projects: [
],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const { profile } = useProfile();
    const { hasPermission, hasRole } = usePermissions();
    const [isLogWeightModalOpen, setIsLogWeightModalOpen] = React.useState(false);
    
    // Check if user has any admin permissions
    const hasAdminAccess = hasPermission('manage_users') || 
                           hasPermission('manage_roles') || 
                           hasPermission('manage_admins') ||
                           hasPermission('manage_invites') ||
                           hasPermission('view_audit_logs') ||
                           hasRole('admin') ||
                           hasRole('super_admin');
    
    // Memoize navigation data to prevent re-adding items on every render
    const navigationData = useMemo(() => {
      const navMain: Array<{
        title: string;
        url: string;
        icon: LucideIcon;
        isActive?: boolean;
        items?: Array<{ title: string; url: string }>;
      }> = [
        {
          title: "Home",
          url: "/home",
          icon: HomeIcon,
          isActive: true,
          items: [],
        },
        {
          title: "Competitions",
          url: "/competitions",
          icon: Bot,
          items: [],
        },
      ];
      
      // Add admin menu item if user has admin access
      if (hasAdminAccess) {
        navMain.push({
          title: 'Admin',
          url: '#',
          icon: Settings2Icon,
          items: [
            {
              title: 'Users',
              url: '/admin/users',
            },
            {
              title: 'Roles',
              url: '/admin/roles'
            },
            {
              title: 'Audit Logs',
              url: '/admin/audit-logs'
            }
          ],
        });
      }
      
      return {
        user: {
          name: profile?.first_name && profile?.last_name 
            ? `${profile.first_name} ${profile.last_name}` 
            : "User",
          email: user?.email || '',
          avatar: user?.avatar 
            ? pb.files.getURL(user, user.avatar) 
            : '/avatars/default.png',
        },
        navMain,
        navSecondary: [
          {
            title: "Log Weight",
            icon: Scale,
            onClick: () => setIsLogWeightModalOpen(true),
          },
          {
            title: "API Tokens",
            url: "/api-tokens",
            icon: Key,
          },
          {
            title: "Support",
            url: "#",
            icon: LifeBuoy,
          },
        ],
        projects: data.projects,
      };
    }, [hasAdminAccess, user, profile]);
  
    const isActive = (path: string) => pathname === path;
  
    const handleSignOut = async () => {
      await signOut();
      router.push('/signin');
    };
  
    // Get avatar URL from user or profile
    const getAvatarUrl = () => {
      // First try to get avatar from user object
      if (user?.avatar) {
        return pb.files.getURL(user, user.avatar);
      }
      // Then try from profile
      if (profile?.avatar) {
        return pb.files.getURL(profile, profile.avatar);
      }
      // Try photo_url from profile
      if (profile?.photo_url) {
        return profile.photo_url;
      }
      return null;
    };
  
    const avatarUrl = getAvatarUrl();
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader> 
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <CloudLightning className="size-4 "/>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">FitClash</span>
                  <span className="truncate text-xs">An Absent Application</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navigationData.navMain} />
        <NavSecondary items={navigationData.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navigationData.user} />
      </SidebarFooter>
      <LogWeightModal
        isOpen={isLogWeightModalOpen}
        onClose={() => setIsLogWeightModalOpen(false)}
        userId={user?.id || ''}
        onWeightLogged={() => {
          setIsLogWeightModalOpen(false);
          // Optionally refresh data
        }}
      />
    </Sidebar>
  )
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  TagIcon,
  FileTextIcon,
  LightbulbIcon,
  SendIcon,
  SplitIcon,
  ActivityIcon,
  ImageIcon,
  BotIcon,
  BarChart3Icon,
  TrendingUpIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Topics", url: "/topics", icon: TagIcon },
  { title: "Contents", url: "/contents", icon: FileTextIcon },
  { title: "Ideas", url: "/ideas", icon: LightbulbIcon },
  { title: "Publications", url: "/publications", icon: SendIcon },
  { title: "Variants", url: "/variants", icon: SplitIcon },
  { title: "Activity", url: "/activity", icon: ActivityIcon },
  { title: "Media", url: "/media", icon: ImageIcon },
];

const analyticsItems = [
  { title: "Campaign", url: "/analytics", icon: BarChart3Icon },
  { title: "Traffic", url: "/analytics/traffic", icon: TrendingUpIcon },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url === "/analytics") return pathname === "/analytics";
    return pathname.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info text-white">
            <BotIcon className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold text-sm text-foreground">Agentic CMS</span>
            <span className="text-xs text-muted-foreground">AI-powered</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarMenu>
            {analyticsItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          v0.2.0 · Built with agents
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

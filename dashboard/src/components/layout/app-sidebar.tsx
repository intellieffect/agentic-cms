"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  FileTextIcon,
  LightbulbIcon,
  SendIcon,
  ActivityIcon,
  ImageIcon,
  BotIcon,
  ChevronRightIcon,
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
  { title: "Contents", url: "/contents", icon: FileTextIcon },
  { title: "Ideas", url: "/ideas", icon: LightbulbIcon },
  { title: "Publications", url: "/publications", icon: SendIcon },
  { title: "Activity", url: "/activity", icon: ActivityIcon },
  { title: "Media", url: "/media", icon: ImageIcon },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
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
                <SidebarMenuButton isActive={isActive(item.url)} tooltip={item.title}>
                  <Link href={item.url} className="flex w-full items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {isActive(item.url) && (
                      <ChevronRightIcon className="ml-auto h-3 w-3 opacity-50" />
                    )}
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

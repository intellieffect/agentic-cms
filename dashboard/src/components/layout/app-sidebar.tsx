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
  VideoIcon,
  BookmarkCheckIcon,
  FilmIcon,
  LayoutTemplateIcon,
  LayersIcon,
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

const cmsNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Topics", url: "/topics", icon: TagIcon },
  { title: "Contents", url: "/contents", icon: FileTextIcon },
  { title: "Ideas", url: "/ideas", icon: LightbulbIcon },
  { title: "Publications", url: "/publications", icon: SendIcon },
  { title: "Variants", url: "/variants", icon: SplitIcon },
  { title: "Activity", url: "/activity", icon: ActivityIcon },
  { title: "Media", url: "/media", icon: ImageIcon },
];

const videoNavItems = [
  { title: "프로젝트", url: "/video/projects", icon: VideoIcon },
  { title: "레퍼런스", url: "/video/references", icon: BookmarkCheckIcon },
  { title: "완료 영상", url: "/video/finished", icon: FilmIcon },
];

const carouselNavItems = [
  { title: "캐러셀", url: "/carousel", icon: LayersIcon },
  { title: "레퍼런스", url: "/carousel/references", icon: BookmarkCheckIcon },
  { title: "템플릿", url: "/carousel/templates", icon: LayoutTemplateIcon },
];

const analyticsNavItems = [
  { title: "Traffic", url: "/analytics/traffic", icon: TrendingUpIcon },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url === "/carousel") return pathname === "/carousel";
    if (url === "/analytics") return pathname === "/analytics";
    return pathname.startsWith(url);
  };

  const renderNavGroup = (
    label: string,
    items: typeof cmsNavItems
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
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
  );

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
        {renderNavGroup("CMS", cmsNavItems)}
        {renderNavGroup("Analytics", analyticsNavItems)}
        {renderNavGroup("영상 (Video)", videoNavItems)}
        {renderNavGroup("캐러셀 (Carousel)", carouselNavItems)}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          v0.2.0 · Built with agents
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

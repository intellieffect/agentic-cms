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
  MailIcon,
  BotIcon,
  VideoIcon,
  BookmarkCheckIcon,
  FilmIcon,
  LayoutTemplateIcon,
  LayersIcon,
  TrendingUpIcon,
  PenSquareIcon,
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

// 파이프라인 플로우 기준 재구성:
//   Overview → Strategy → Pipeline(Ideas→Contents→Variants)
//     → Production(Media) → Carousel Studio → Video Studio
//     → Distribution(Blog/Newsletter/Publications) → Intelligence(Analytics/Activity)
//
// 기존 URL 경로는 모두 유지 — 그룹명과 순서만 재배치.

type NavItem = { title: string; url: string; icon: React.ComponentType };

const overviewNavItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
];

const strategyNavItems: NavItem[] = [
  { title: "Topics", url: "/topics", icon: TagIcon },
];

const pipelineNavItems: NavItem[] = [
  { title: "Ideas", url: "/ideas", icon: LightbulbIcon },
  { title: "Contents", url: "/contents", icon: FileTextIcon },
  { title: "Variants", url: "/variants", icon: SplitIcon },
];

const productionNavItems: NavItem[] = [
  { title: "Media", url: "/media", icon: ImageIcon },
];

const carouselNavItems: NavItem[] = [
  { title: "캐러셀", url: "/carousel", icon: LayersIcon },
  { title: "레퍼런스", url: "/carousel/references", icon: BookmarkCheckIcon },
  { title: "템플릿", url: "/carousel/templates", icon: LayoutTemplateIcon },
];

const videoNavItems: NavItem[] = [
  { title: "프로젝트", url: "/video/projects", icon: VideoIcon },
  { title: "레퍼런스", url: "/video/references", icon: BookmarkCheckIcon },
  { title: "완료 영상", url: "/video/finished", icon: FilmIcon },
];

const distributionNavItems: NavItem[] = [
  { title: "Blog", url: "/blog-manage", icon: PenSquareIcon },
  { title: "Newsletter", url: "/newsletter", icon: MailIcon },
  { title: "Publications", url: "/publications", icon: SendIcon },
];

const intelligenceNavItems: NavItem[] = [
  // 하위에 페이지가 늘어나면 그룹명을 유지하고 item 은 구체명(Traffic) 을 쓴다.
  // 기존 e2e 테스트(analytics.spec.ts) 가 "Traffic" text 로 assert 하므로 유지.
  { title: "Traffic", url: "/analytics/traffic", icon: TrendingUpIcon },
  { title: "Activity", url: "/activity", icon: ActivityIcon },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url === "/carousel") return pathname === "/carousel";
    if (url === "/analytics") return pathname === "/analytics";
    return pathname.startsWith(url);
  };

  const renderNavGroup = (label: string, items: NavItem[]) => (
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
        {renderNavGroup("Overview", overviewNavItems)}
        {renderNavGroup("Strategy", strategyNavItems)}
        {renderNavGroup("Pipeline", pipelineNavItems)}
        {renderNavGroup("Production", productionNavItems)}
        {renderNavGroup("Carousel Studio", carouselNavItems)}
        {renderNavGroup("Video Studio", videoNavItems)}
        {renderNavGroup("Distribution", distributionNavItems)}
        {renderNavGroup("Intelligence", intelligenceNavItems)}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          v0.2.0 · Built with agents
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

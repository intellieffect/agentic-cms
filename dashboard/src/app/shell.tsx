"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { CommandMenu } from "@/components/command-menu";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="relative z-20 flex flex-1 flex-col">
        <Header />
        {children}
      </div>
      <CommandMenu />
    </SidebarProvider>
  );
}

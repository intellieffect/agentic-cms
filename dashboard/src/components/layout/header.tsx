"use client";

import { SearchIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  children?: React.ReactNode;
  onOpenCommandMenu?: () => void;
}

export function Header({ children, onOpenCommandMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-lg">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      {children}
      <div className="ml-auto">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-muted-foreground"
          onClick={onOpenCommandMenu}
        >
          <SearchIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            ⌘K
          </kbd>
        </Button>
      </div>
    </header>
  );
}

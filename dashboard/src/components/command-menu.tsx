"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboardIcon,
  FileTextIcon,
  LightbulbIcon,
  SendIcon,
  ActivityIcon,
  ImageIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const pages = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Contents", url: "/contents", icon: FileTextIcon },
  { title: "Ideas", url: "/ideas", icon: LightbulbIcon },
  { title: "Publications", url: "/publications", icon: SendIcon },
  { title: "Activity Log", url: "/activity", icon: ActivityIcon },
  { title: "Media Library", url: "/media", icon: ImageIcon },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    []
  );

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.url}
                value={page.title}
                onSelect={() => runCommand(() => router.push(page.url))}
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/contents"))}
            >
              <FileTextIcon className="mr-2 h-4 w-4" />
              View Content Pipeline
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <CommandMenuTrigger open={open} setOpen={setOpen} />
    </>
  );
}

function CommandMenuTrigger({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  // This is a hidden component — the header button and Cmd+K both control the dialog
  return null;
}

export function useCommandMenu() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, toggle: () => setOpen((o) => !o) };
}

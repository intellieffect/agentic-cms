"use client";

import { useState } from "react";
import { ArrowUpCircleIcon, CheckCircleIcon, SearchIcon } from "lucide-react";
import type { Idea } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

interface IdeasListProps {
  ideas: Idea[];
}

export function IdeasList({ ideas }: IdeasListProps) {
  const [search, setSearch] = useState("");

  const filtered = ideas.filter((idea) =>
    idea.raw_text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search ideas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No ideas found
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((idea) => (
            <Card key={idea.id} className="group">
              <CardContent className="flex items-start gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">{idea.raw_text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {idea.source && (
                      <Badge variant="outline" className="text-xs">
                        {idea.source}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(idea.created_at)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0">
                  {idea.promoted_to ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircleIcon className="h-3 w-3" />
                      Promoted
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity" disabled>
                      <ArrowUpCircleIcon className="h-3.5 w-3.5" />
                      Promote
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

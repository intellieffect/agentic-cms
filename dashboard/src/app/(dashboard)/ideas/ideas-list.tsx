"use client";

import { useState } from "react";
import { ArrowUpCircleIcon, CheckCircleIcon, SearchIcon } from "lucide-react";
import type { Idea, Topic } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

interface IdeasListProps {
  ideas: Idea[];
  topics: Topic[];
}

function getIntentVariant(intent: string | null | undefined) {
  const normalized = intent?.toLowerCase() ?? "";

  if (normalized.includes("transaction") || normalized.includes("conversion") || normalized.includes("convert")) {
    return "success" as const;
  }

  if (normalized.includes("commercial") || normalized.includes("consideration") || normalized.includes("engage")) {
    return "warning" as const;
  }

  if (normalized.includes("informational") || normalized.includes("awareness") || normalized.includes("educate")) {
    return "info" as const;
  }

  return "secondary" as const;
}

export function IdeasList({ ideas, topics }: IdeasListProps) {
  const [search, setSearch] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

  const filtered = ideas.filter((idea) => {
    const topic = idea.topic_id ? topicsById.get(idea.topic_id) : undefined;
    const searchableValues = [idea.raw_text, idea.angle, topic?.name].filter(
      (value): value is string => Boolean(value)
    );
    const matchesSearch = searchableValues.some((value) =>
      value.toLowerCase().includes(search.toLowerCase())
    );
    const matchesTopic = !selectedTopicId || idea.topic_id === selectedTopicId;

    return matchesSearch && matchesTopic;
  });

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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={selectedTopicId === null ? "secondary" : "outline"}
          onClick={() => setSelectedTopicId(null)}
        >
          All Topics
        </Button>
        {topics.map((topic) => (
          <Button
            key={topic.id}
            type="button"
            size="sm"
            variant={selectedTopicId === topic.id ? "secondary" : "outline"}
            onClick={() => setSelectedTopicId(topic.id)}
          >
            {topic.name}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No ideas found
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((idea) => {
            const topic = idea.topic_id ? topicsById.get(idea.topic_id) : undefined;

            return (
              <Card key={idea.id} className="group">
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {topic && (
                        <Badge variant={getIntentVariant(topic.intent)}>
                          {topic.name}
                        </Badge>
                      )}
                      {idea.source && (
                        <Badge variant="outline" className="text-xs">
                          {idea.source}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{idea.raw_text}</p>
                    {idea.angle && (
                      <p className="mt-2 text-sm text-muted-foreground">{idea.angle}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                        disabled
                      >
                        <ArrowUpCircleIcon className="h-3.5 w-3.5" />
                        Promote
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

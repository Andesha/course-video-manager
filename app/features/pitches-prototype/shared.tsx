/**
 * PROTOTYPE — shared types, mock data, and components for the Pitches UI.
 * Imported by app/routes/prototype.pitches.tsx and prototype.pitches.$pitchId.tsx.
 *
 * Throwaway. Delete when the design folds into a real route.
 */

import {
  CalendarClock,
  FileVideo,
  Lightbulb,
  Plus,
  XCircle,
} from "lucide-react";
import { Link } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────

export type PitchStatus = "idle" | "scheduled" | "cancelled";
export type PitchPriority = 1 | 2 | 3;

export interface PitchVideo {
  id: string;
  path: string;
  durationSeconds: number;
  hasExport: boolean;
  thumbnailUrl: string | null;
}

export interface Pitch {
  id: string;
  title: string;
  description: string;
  youtubeTitle: string;
  youtubeThumbnailDescription: string;
  newsletterTitle: string;
  tweet: string;
  status: PitchStatus;
  priority: PitchPriority;
  archived: boolean;
  createdAt: string;
  videos: PitchVideo[];
}

// ─── Mock data ────────────────────────────────────────────────────

export const MOCK_PITCHES: Pitch[] = [
  {
    id: "p_001",
    title: "Why your tsconfig is probably wrong",
    description:
      "A walkthrough of the 5 settings most TypeScript devs leave on defaults that hurt them later.",
    youtubeTitle: "Your tsconfig is WRONG (and here's how to fix it)",
    youtubeThumbnailDescription:
      "Frustrated dev face, big red X over a tsconfig.json snippet, neon yellow arrow",
    newsletterTitle: "The five tsconfig settings I always change",
    tweet:
      "Most TS devs ship with a default tsconfig. That's a bug. Here's the 5-setting checklist I run on every new repo →",
    status: "scheduled",
    priority: 1,
    archived: false,
    createdAt: "2026-04-22T10:00:00Z",
    videos: [
      {
        id: "v_aaa",
        path: "tsconfig-walkthrough",
        durationSeconds: 643,
        hasExport: true,
        thumbnailUrl: null,
      },
      {
        id: "v_bbb",
        path: "tsconfig-strict-mode",
        durationSeconds: 412,
        hasExport: false,
        thumbnailUrl: null,
      },
    ],
  },
  {
    id: "p_002",
    title: "Effect's Layer system, finally explained",
    description:
      "Layers are the hardest part of Effect to internalise. This pitch reframes them as 'lazy DI containers'.",
    youtubeTitle: "Effect Layers are just lazy DI (no really)",
    youtubeThumbnailDescription:
      "Two side-by-side panels: vanilla DI on the left, Effect Layer on the right, 'SAME THING' between them",
    newsletterTitle: "Layers, demystified",
    tweet:
      "If Effect's Layer system has been making you feel dumb: it's just dependency injection that's allowed to be lazy. That's the whole insight.",
    status: "idle",
    priority: 2,
    archived: false,
    createdAt: "2026-04-29T10:00:00Z",
    videos: [],
  },
  {
    id: "p_003",
    title: "The case against barrel files",
    description:
      "I've removed every barrel file from my last 3 repos. Here's why, and what to do instead.",
    youtubeTitle: "Stop using barrel files (here's why)",
    youtubeThumbnailDescription:
      "A literal barrel on fire, with index.ts written on the side",
    newsletterTitle: "Barrel files: a slow poison",
    tweet:
      "I deleted every barrel file in my main repo last week. Build time dropped 40%. Here's what I did instead →",
    status: "idle",
    priority: 2,
    archived: false,
    createdAt: "2026-05-01T10:00:00Z",
    videos: [
      {
        id: "v_ccc",
        path: "no-barrels",
        durationSeconds: 521,
        hasExport: true,
        thumbnailUrl: null,
      },
    ],
  },
  {
    id: "p_004",
    title: "Generics for people who think they hate generics",
    description: "A gentle on-ramp into TS generics, focusing on inference.",
    youtubeTitle: "TypeScript generics: it clicked for me when I saw this",
    youtubeThumbnailDescription:
      "Lightbulb moment, generic angle brackets glowing",
    newsletterTitle: "Generics: an inference-first walkthrough",
    tweet:
      "Generics aren't about <T>. They're about inference. Once you flip that mental model, everything gets easier.",
    status: "cancelled",
    priority: 3,
    archived: false,
    createdAt: "2026-03-15T10:00:00Z",
    videos: [],
  },
  {
    id: "p_005",
    title: "satisfies vs as vs : — a decision tree",
    description: "One flowchart. Five minutes. Never confused again.",
    youtubeTitle: "satisfies, as, or : — a 5-minute decision tree",
    youtubeThumbnailDescription:
      "A flowchart with three branches, clean white background",
    newsletterTitle: "Three ways to type a value",
    tweet:
      "satisfies vs as vs : — they look interchangeable, they aren't. Here's the decision tree I use.",
    status: "scheduled",
    priority: 1,
    archived: false,
    createdAt: "2026-04-30T10:00:00Z",
    videos: [],
  },
  {
    id: "p_006",
    title: "Why I stopped using interfaces",
    description: "Just types. Always types. Here's the case.",
    youtubeTitle: "I haven't used 'interface' in 2 years",
    youtubeThumbnailDescription:
      "Crossed-out 'interface' keyword, 'type' keyword glowing",
    newsletterTitle: "Type vs interface: the long answer",
    tweet:
      "I haven't typed 'interface' in 2 years. Code is better. Here's the argument.",
    status: "idle",
    priority: 3,
    archived: false,
    createdAt: "2026-02-10T10:00:00Z",
    videos: [],
  },
];

// ─── Priority pill ────────────────────────────────────────────────

export const PRIORITY_STYLES: Record<PitchPriority, string> = {
  1: "bg-red-500/20 text-red-600",
  2: "bg-yellow-500/20 text-yellow-600",
  3: "bg-sky-500/20 text-sky-500",
};

const PRIORITY_DOT: Record<PitchPriority, string> = {
  1: "bg-red-500",
  2: "bg-yellow-500",
  3: "bg-sky-500",
};

export const PRIORITY_LABELS: Record<PitchPriority, string> = {
  1: "P1 — High",
  2: "P2 — Medium",
  3: "P3 — Low",
};

export function PriorityPill({
  priority,
  onSelect,
  readOnly,
}: {
  priority: PitchPriority;
  onSelect?: (p: PitchPriority) => void;
  readOnly?: boolean;
}) {
  const trigger = (
    <button
      className={cn(
        "flex-shrink-0 text-xs px-2 py-0.5 rounded-sm font-medium",
        PRIORITY_STYLES[priority]
      )}
      title={readOnly ? `P${priority}` : "Click to set priority"}
      onClick={(e) => e.stopPropagation()}
    >
      P{priority}
    </button>
  );
  if (readOnly || !onSelect) return trigger;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {([1, 2, 3] as const).map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p);
            }}
            className={cn("text-xs font-medium", priority === p && "bg-accent")}
          >
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full mr-1",
                PRIORITY_DOT[p]
              )}
            />
            {PRIORITY_LABELS[p]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Status meta (icons per state, all greyscale) ─────────────────

export const STATUS_META: Record<
  PitchStatus,
  {
    label: string;
    icon: typeof Lightbulb;
    iconWrap: string;
  }
> = {
  idle: {
    label: "Idle",
    icon: Lightbulb,
    iconWrap: "bg-muted text-muted-foreground",
  },
  scheduled: {
    label: "Scheduled",
    icon: CalendarClock,
    iconWrap: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    iconWrap: "bg-muted text-muted-foreground",
  },
};

export function StatusIconBadge({
  status,
  onSelect,
  readOnly,
}: {
  status: PitchStatus;
  onSelect?: (s: PitchStatus) => void;
  readOnly?: boolean;
}) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  const trigger = (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-full",
        m.iconWrap
      )}
      title={readOnly ? m.label : `${m.label} — click to change`}
      onClick={(e) => e.stopPropagation()}
    >
      <Icon className="w-3 h-3" />
    </button>
  );
  if (readOnly || !onSelect) return trigger;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {(["idle", "scheduled", "cancelled"] as const).map((s) => {
          const sm = STATUS_META[s];
          const SIcon = sm.icon;
          return (
            <DropdownMenuItem
              key={s}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s);
              }}
              className={cn(
                "text-xs font-medium flex items-center gap-2",
                status === s && "bg-accent"
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center w-5 h-5 rounded-full",
                  sm.iconWrap
                )}
              >
                <SIcon className="w-3 h-3" />
              </span>
              {sm.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Inline video strip ───────────────────────────────────────────

export function formatTimeCode(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function PitchVideoStrip({ videos }: { videos: PitchVideo[] }) {
  if (videos.length === 0) {
    return (
      <button
        className="ml-5 mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded px-2 py-1.5 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Plus className="w-3.5 h-3.5" />
        Video
      </button>
    );
  }

  return (
    <div className="ml-5 mt-3 flex flex-wrap gap-4">
      {videos.map((video) => (
        <a
          key={video.id}
          href={`/videos/${video.id}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="text-left items-center group/thumb bg-muted rounded overflow-hidden inline-flex hover:ring-1 hover:ring-foreground/20 transition-all"
        >
          <div className="relative aspect-video w-32 bg-muted">
            <div className="w-full h-full flex items-center justify-center border-r">
              <FileVideo className="w-6 h-6 text-muted-foreground/40" />
            </div>
            {!video.hasExport && (
              <div
                className="absolute top-2 left-2 w-2 h-2 rounded-full bg-red-500"
                title="Not exported"
              />
            )}
          </div>
          <div className="py-1 px-6 flex flex-col items-center text-muted-foreground">
            <span className="text-xs truncate text-foreground transition-colors">
              {video.path}
            </span>
            <span className="text-xs font-mono mt-0.5">
              {formatTimeCode(video.durationSeconds)}
            </span>
          </div>
        </a>
      ))}
      <button
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded px-3 transition-colors"
        onClick={(e) => e.stopPropagation()}
        title="Create another Video from this Pitch"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Top nav ──────────────────────────────────────────────────────

export function PrototypeNav({ active }: { active: string }) {
  const items = [
    { key: "courses", label: "Courses", to: "/" },
    { key: "videos", label: "Videos", to: "/videos" },
    { key: "pitches", label: "Pitches", to: "/prototype/pitches" },
  ];
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b">
      <div className="flex items-center gap-1 px-4 py-2">
        <span className="text-xs font-mono text-muted-foreground mr-3">
          CVM
        </span>
        {items.map((it) => (
          <Link
            key={it.key}
            to={it.to}
            className={cn(
              "px-3 py-1.5 rounded text-sm",
              active === it.key
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {it.label}
            {it.key === "pitches" && (
              <Badge className="ml-1.5 h-4 text-[10px] px-1">new</Badge>
            )}
          </Link>
        ))}
      </div>
    </header>
  );
}

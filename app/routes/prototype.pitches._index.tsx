/**
 * PROTOTYPE — Pitches list page
 *
 * Throwaway. URL: /prototype/pitches
 * Detail page: /prototype/pitches/:pitchId
 */

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Filter,
  Lightbulb,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MOCK_PITCHES,
  PRIORITY_STYLES,
  PitchVideoStrip,
  PriorityPill,
  PrototypeNav,
  STATUS_META,
  StatusIconBadge,
  type Pitch,
  type PitchPriority,
  type PitchStatus,
} from "@/features/pitches-prototype/shared";

// ─── Filter bar ───────────────────────────────────────────────────

type StatusFilter = PitchStatus[];

function PitchFilterBar({
  query,
  setQuery,
  priorityFilter,
  togglePriority,
  statusFilter,
  setStatusFilter,
  clearAll,
}: {
  query: string;
  setQuery: (q: string) => void;
  priorityFilter: PitchPriority[];
  togglePriority: (p: PitchPriority) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  clearAll: () => void;
}) {
  const hasActive =
    query.length > 0 ||
    priorityFilter.length > 0 ||
    statusFilter.length !== 1 ||
    !statusFilter.includes("idle");

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search pitches"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 h-8 text-sm max-w-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filters:</span>

        {([1, 2, 3] as const).map((priority) => {
          const isSelected = priorityFilter.includes(priority);
          const showAsActive = priorityFilter.length === 0 || isSelected;
          return (
            <button
              key={priority}
              className={cn(
                "text-xs px-2 py-0.5 rounded-sm font-medium transition-colors",
                showAsActive
                  ? PRIORITY_STYLES[priority]
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                isSelected && "ring-1 ring-current"
              )}
              onClick={() => togglePriority(priority)}
            >
              P{priority}
            </button>
          );
        })}

        <span className="text-muted-foreground mx-0.5">|</span>

        <StatusFilterDropdown value={statusFilter} onChange={setStatusFilter} />

        {hasActive && (
          <>
            <span className="text-muted-foreground mx-0.5">|</span>
            <button
              className="text-xs px-2 py-0.5 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={clearAll}
            >
              Clear all
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const allStatuses: PitchStatus[] = ["idle", "scheduled", "cancelled"];
  const toggle = (s: PitchStatus) => {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  };

  const summary =
    value.length === 0
      ? "No status"
      : value.length === allStatuses.length
        ? "All status"
        : value.map((s) => STATUS_META[s].label).join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
          <Filter className="w-3 h-3" />
          {summary}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {allStatuses.map((s) => {
          const m = STATUS_META[s];
          const Icon = m.icon;
          const isOn = value.includes(s);
          return (
            <DropdownMenuItem
              key={s}
              onClick={(e) => {
                e.preventDefault();
                toggle(s);
              }}
              className={cn(
                "text-xs font-medium flex items-center gap-2",
                isOn && "bg-accent"
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center w-5 h-5 rounded-full",
                  m.iconWrap
                )}
              >
                <Icon className="w-3 h-3" />
              </span>
              <span className="flex-1">{m.label}</span>
              {isOn && <span className="text-xs opacity-60">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Pitch row ────────────────────────────────────────────────────

function PitchRow({
  pitch,
  onPriorityChange,
  onStatusChange,
}: {
  pitch: Pitch;
  onPriorityChange: (p: PitchPriority) => void;
  onStatusChange: (s: PitchStatus) => void;
}) {
  return (
    <div className="border rounded-lg bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 px-4 pt-3">
        <StatusIconBadge status={pitch.status} onSelect={onStatusChange} />
        <Link
          to={`/prototype/pitches/${pitch.id}`}
          className="flex-1 min-w-0 font-medium truncate"
        >
          {pitch.title}
        </Link>
        <PriorityPill priority={pitch.priority} onSelect={onPriorityChange} />
      </div>
      {pitch.description && (
        <p className="ml-12 mr-4 mt-1 text-xs text-muted-foreground line-clamp-2">
          {pitch.description}
        </p>
      )}
      <div className="px-4 pb-3">
        <PitchVideoStrip videos={pitch.videos} />
      </div>
    </div>
  );
}

// ─── Post-page pre-fill preview ───────────────────────────────────

function PostPagePreview({ pitch }: { pitch: Pitch }) {
  return (
    <div className="mt-12 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/30 dark:bg-amber-950/20 p-5">
      <div className="flex items-center gap-2 mb-3 text-amber-900 dark:text-amber-200">
        <Sparkles className="size-4" />
        <h2 className="font-semibold text-sm">
          Preview: post-page pre-fill behaviour
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        When a video has a <code className="font-mono">pitchId</code>, the
        existing post page reads pitch values <em>live</em> and pre-fills these
        fields. The "Generate" buttons stay; nothing is snapshotted onto the
        video row.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <PrefillField
          icon={<Youtube className="size-3.5" />}
          label="YouTube title"
          value={pitch.youtubeTitle}
          source={pitch.title}
        />
        <PrefillField
          icon={<Mail className="size-3.5" />}
          label="Newsletter title"
          value={pitch.newsletterTitle}
          source={pitch.title}
        />
        <PrefillField
          icon={<MessageSquare className="size-3.5" />}
          label="Tweet"
          value={pitch.tweet}
          source={pitch.title}
        />
      </div>
    </div>
  );
}

function PrefillField(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  source: string;
}) {
  return (
    <div className="rounded border bg-background p-3">
      <Label className="flex items-center gap-1.5 text-xs mb-1">
        {props.icon}
        {props.label}
      </Label>
      <Textarea defaultValue={props.value} rows={3} className="text-xs" />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground italic truncate">
          ← from pitch "{props.source}"
        </span>
        <Button size="sm" variant="ghost" className="h-6 text-xs">
          <Sparkles className="size-3 mr-1" />
          Generate
        </Button>
      </div>
    </div>
  );
}

// ─── Route entry ──────────────────────────────────────────────────

export default function PitchesPrototypeRoute() {
  const [pitches, setPitches] = useState(MOCK_PITCHES);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PitchPriority[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(["idle"]);

  const filtered = useMemo(() => {
    return pitches
      .filter((p) => !p.archived)
      .filter((p) => statusFilter.includes(p.status))
      .filter((p) =>
        priorityFilter.length === 0 ? true : priorityFilter.includes(p.priority)
      )
      .filter((p) =>
        query
          ? p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [pitches, statusFilter, priorityFilter, query]);

  const togglePriority = (p: PitchPriority) => {
    setPriorityFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const setPitchPriority = (id: string, priority: PitchPriority) => {
    setPitches((prev) =>
      prev.map((p) => (p.id === id ? { ...p, priority } : p))
    );
  };

  const setPitchStatus = (id: string, status: PitchStatus) => {
    setPitches((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const clearAll = () => {
    setQuery("");
    setPriorityFilter([]);
    setStatusFilter(["idle"]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrototypeNav active="pitches" />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="size-6" />
            Pitches
            <span className="text-base font-normal text-muted-foreground">
              {filtered.length}
            </span>
          </h1>
          <Button>
            <Plus className="size-4 mr-1" /> New Pitch
          </Button>
        </div>

        <div className="mb-6">
          <PitchFilterBar
            query={query}
            setQuery={setQuery}
            priorityFilter={priorityFilter}
            togglePriority={togglePriority}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            clearAll={clearAll}
          />
        </div>

        <div className="space-y-3">
          {filtered.map((p) => (
            <PitchRow
              key={p.id}
              pitch={p}
              onPriorityChange={(priority) => setPitchPriority(p.id, priority)}
              onStatusChange={(status) => setPitchStatus(p.id, status)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              No pitches match these filters.
            </div>
          )}
        </div>

        {pitches[0] && <PostPagePreview pitch={pitches[0]} />}
      </div>
    </div>
  );
}

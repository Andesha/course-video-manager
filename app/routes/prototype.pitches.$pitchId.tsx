/**
 * PROTOTYPE — Pitch detail page
 *
 * Throwaway. URL: /prototype/pitches/:pitchId
 * Live-updates every field with a 600ms throttle. No Save / Cancel buttons.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  Video,
  Youtube,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MOCK_PITCHES,
  PitchVideoStrip,
  PriorityPill,
  PrototypeNav,
  StatusIconBadge,
  type Pitch,
} from "@/features/pitches-prototype/shared";

const SAVE_THROTTLE_MS = 600;

function ChannelSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide pb-1.5 border-b">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type SaveState = "idle" | "pending" | "saved";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="w-3 h-3" />
      Saved
    </span>
  );
}

/**
 * Throttled "save" effect. Whenever `pitch` changes, schedule a save in
 * SAVE_THROTTLE_MS. Each new change resets the timer. While the timer is
 * pending, state is "pending". When it fires, state is "saved" briefly.
 */
function useThrottledSave(pitch: Pitch) {
  const [state, setState] = useState<SaveState>("idle");
  const isFirst = useRef(true);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    setState("pending");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    const t = setTimeout(() => {
      // No backend — pretend we just persisted.
      setState("saved");
      savedTimer.current = setTimeout(() => setState("idle"), 1200);
    }, SAVE_THROTTLE_MS);
    return () => clearTimeout(t);
  }, [pitch]);

  return state;
}

export default function PitchDetailPrototypeRoute() {
  const params = useParams();
  const initial = MOCK_PITCHES.find((p) => p.id === params.pitchId);

  if (!initial) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PrototypeNav active="pitches" />
        <div className="max-w-3xl mx-auto p-6">
          <Link
            to="/prototype/pitches"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pitches
          </Link>
          <p className="text-muted-foreground">
            No pitch found with id <code>{params.pitchId}</code>.
          </p>
        </div>
      </div>
    );
  }

  return <PitchDetail initial={initial} />;
}

function PitchDetail({ initial }: { initial: Pitch }) {
  const [pitch, setPitch] = useState<Pitch>(initial);
  const saveState = useThrottledSave(pitch);

  const update = <K extends keyof Pitch>(key: K, value: Pitch[K]) =>
    setPitch((p) => ({ ...p, [key]: value }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrototypeNav active="pitches" />
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/prototype/pitches"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pitches
          </Link>
          <SaveIndicator state={saveState} />
        </div>

        <Input
          value={pitch.title}
          onChange={(e) => update("title", e.target.value)}
          aria-label="Title"
          className="text-3xl font-bold h-auto px-0 py-1 mb-3 border-0 shadow-none focus-visible:ring-0 focus-visible:border-b focus-visible:rounded-none md:text-3xl"
        />

        <div className="flex items-center gap-2 mb-8">
          <StatusIconBadge
            status={pitch.status}
            onSelect={(s) => update("status", s)}
          />
          <PriorityPill
            priority={pitch.priority}
            onSelect={(p: PitchPriorityValue) => update("priority", p)}
          />
        </div>

        <div className="space-y-8">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={pitch.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
            />
          </div>

          <ChannelSection icon={<Youtube className="size-4" />} title="YouTube">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Textarea
                value={pitch.youtubeTitle}
                onChange={(e) => update("youtubeTitle", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Thumbnail concept</Label>
              <Textarea
                value={pitch.youtubeThumbnailDescription}
                onChange={(e) =>
                  update("youtubeThumbnailDescription", e.target.value)
                }
                rows={2}
              />
            </div>
          </ChannelSection>

          <ChannelSection icon={<Mail className="size-4" />} title="Newsletter">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={pitch.newsletterTitle}
                onChange={(e) => update("newsletterTitle", e.target.value)}
              />
            </div>
          </ChannelSection>

          <ChannelSection
            icon={<MessageSquare className="size-4" />}
            title="Twitter"
          >
            <div className="space-y-1.5">
              <Label>Tweet</Label>
              <Textarea
                value={pitch.tweet}
                onChange={(e) => update("tweet", e.target.value)}
                rows={2}
              />
            </div>
          </ChannelSection>

          <ChannelSection icon={<Video className="size-4" />} title="Videos">
            <PitchVideoStrip videos={pitch.videos} />
          </ChannelSection>
        </div>
      </div>
    </div>
  );
}

// alias for the priority generic in the onSelect callback above
type PitchPriorityValue = Pitch["priority"];

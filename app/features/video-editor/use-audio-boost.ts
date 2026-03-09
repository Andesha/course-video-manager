import { useEffect, useRef } from "react";

/**
 * Connects a video element to a Web Audio graph with a GainNode
 * to boost audio volume beyond the native 1.0 maximum.
 *
 * Once connected via createMediaElementSource, audio is permanently
 * routed through the graph for the element's lifetime. Muting the
 * element still works normally.
 */
export function useAudioBoost(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  boostDb: number
) {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || audioContextRef.current) {
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, boostDb / 20);

    source.connect(gain);
    gain.connect(ctx.destination);

    audioContextRef.current = ctx;

    return () => {
      ctx.close();
      audioContextRef.current = null;
    };
  }, [videoRef, boostDb]);
}

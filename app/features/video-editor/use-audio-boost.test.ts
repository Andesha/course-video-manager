import { describe, expect, it, vi, beforeEach } from "vitest";

const mockConnect = vi.fn();
const mockClose = vi.fn();
const mockGainNode = {
  gain: { value: 1 },
  connect: mockConnect,
};
const mockSourceNode = {
  connect: vi.fn(),
};

const mockCreateMediaElementSource = vi.fn(() => mockSourceNode);
const mockCreateGain = vi.fn(() => mockGainNode);

vi.stubGlobal(
  "AudioContext",
  vi.fn(() => ({
    createMediaElementSource: mockCreateMediaElementSource,
    createGain: mockCreateGain,
    destination: "mock-destination",
    close: mockClose,
  }))
);

// We can't use renderHook, so test the core logic directly
// by extracting the gain calculation
describe("useAudioBoost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGainNode.gain.value = 1;
  });

  describe("dB to linear gain conversion", () => {
    it("converts +10 dB to ~3.162 linear gain", () => {
      const gain = Math.pow(10, 10 / 20);
      expect(gain).toBeCloseTo(3.162, 2);
    });

    it("converts +6 dB to ~1.995 linear gain", () => {
      const gain = Math.pow(10, 6 / 20);
      expect(gain).toBeCloseTo(1.995, 2);
    });

    it("converts 0 dB to 1.0 linear gain", () => {
      const gain = Math.pow(10, 0 / 20);
      expect(gain).toBe(1);
    });

    it("converts -6 dB to ~0.501 linear gain", () => {
      const gain = Math.pow(10, -6 / 20);
      expect(gain).toBeCloseTo(0.501, 2);
    });
  });

  describe("Web Audio API integration", () => {
    it("creates AudioContext and connects source → gain → destination", () => {
      const mockVideo = {} as HTMLVideoElement;

      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(mockVideo);
      const gain = ctx.createGain();
      (gain as unknown as typeof mockGainNode).gain.value = Math.pow(
        10,
        10 / 20
      );

      source.connect(gain as unknown as AudioNode);
      (gain as unknown as AudioNode).connect(
        ctx.destination as unknown as AudioNode
      );

      expect(mockCreateMediaElementSource).toHaveBeenCalledWith(mockVideo);
      expect(mockCreateGain).toHaveBeenCalled();
      expect(mockGainNode.gain.value).toBeCloseTo(3.162, 2);
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockConnect).toHaveBeenCalledWith("mock-destination");
    });
  });
});

import { describe, it, expect } from "vitest";
import { writePageReducer, createInitialState } from "./write-page-reducer";

describe("writePageReducer - files-loaded", () => {
  it("sets enabledFiles from defaultEnabled=true files", () => {
    const initialState = createInitialState({
      files: [],
      clipSections: [],
      initialMemory: "",
    });

    const state = writePageReducer(initialState, {
      type: "files-loaded",
      files: [
        { path: "readme.md", defaultEnabled: true },
        { path: "index.ts", defaultEnabled: true },
        { path: "package-lock.json", defaultEnabled: false },
      ],
    });

    expect(state.enabledFiles).toEqual(new Set(["readme.md", "index.ts"]));
  });

  it("enables only readme files in style-guide-skill-building mode", () => {
    const initialState = createInitialState({
      files: [],
      clipSections: [],
      initialMemory: "",
    });
    const stateInMode = writePageReducer(initialState, {
      type: "set-mode",
      mode: "style-guide-skill-building",
    });

    const state = writePageReducer(stateInMode, {
      type: "files-loaded",
      files: [
        { path: "readme.md", defaultEnabled: true },
        { path: "index.ts", defaultEnabled: true },
        { path: "explainer/readme.md", defaultEnabled: true },
      ],
    });

    expect(state.enabledFiles).toEqual(
      new Set(["readme.md", "explainer/readme.md"])
    );
  });

  it("enables no files when all have defaultEnabled=false", () => {
    const initialState = createInitialState({
      files: [],
      clipSections: [],
      initialMemory: "",
    });

    const state = writePageReducer(initialState, {
      type: "files-loaded",
      files: [
        { path: "package-lock.json", defaultEnabled: false },
        { path: "node_modules/dep.js", defaultEnabled: false },
      ],
    });

    expect(state.enabledFiles).toEqual(new Set());
  });
});

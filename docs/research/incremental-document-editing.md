# Incremental Document Editing via Tool Calls

## Problem

The Text Writing Agent currently regenerates the entire document on every interaction. This means:

- User edits get blown away on each AI turn
- No way to ask the AI to make a targeted change ("reword this paragraph", "add a section here")
- Wasteful token usage for small edits on large documents
- The AI can't act as a proper writing assistant — it's a writing _replacer_

The goal: give the AI tool calls to **edit** a document incrementally, so the user can make their own edits and the AI modifies around them.

---

## Industry Approaches

### 1. Search-and-Replace (Industry Consensus)

The LLM provides an `old_text` string to find and a `new_text` string to replace it with.

**Used by:** Claude Code, Claude Artifacts, Aider, OpenAI Canvas, Codex CLI

**Pros:**

- LLMs are good at reproducing exact strings from context
- No line numbers to hallucinate
- Naturally handles all edit types (rewrite, delete, insert, fix typos)
- Simple to implement and validate

**Cons:**

- `old_text` must be unique in the document — ambiguous matches fail
- LLMs sometimes get whitespace/formatting slightly wrong
- For insertions, it's awkward (you have to "replace" a heading with "heading + new content")

**Aider's format** uses git-merge-conflict-style markers:

```
<<<<<<< SEARCH
[original text]
=======
[replacement text]
>>>>>>> REPLACE
```

**Claude Code's format** uses structured tool params: `old_string`, `new_string`, `replace_all`.

### 2. Regex Pattern Matching (OpenAI Canvas)

Canvas uses Python regex patterns via `re.finditer` with `re.Match.expand` for replacements. Has a `multiple` boolean for matching once vs many times. Uses `".*"` pattern to trigger full document rewrites.

**Pros:** More flexible than exact matching
**Cons:** LLMs aren't great at writing regex; adds complexity and error surface

### 3. Full Document Rewrite

The LLM returns the entire new document. Used as an escape hatch by most systems.

**Used by:** Aider ("whole" format), Claude Artifacts ("rewrite" command), Canvas (`".*"` pattern)

**Pros:** Simple, no matching logic, natural for models (training data is mostly complete documents)
**Cons:** Expensive for large documents, destroys user edits, lazy for small changes

### 4. Unified Diff Format

Standard `diff -U` notation with `+`/`-` line prefixes and `@@` hunk headers.

**Used by:** Aider's "udiff" format. Originally designed to combat GPT-4 Turbo's "lazy coding" — reduced laziness by 3x.

**Fatal flaw:** LLMs hallucinate line numbers. Tokenizers compress digit sequences into single tokens, forcing the model to commit to a number on the first token. **Every successful system avoids line numbers.**

### 5. Context-Anchored Patches (Codex CLI)

A hybrid that avoids line numbers entirely. Uses `@@` followed by nearby landmarks (like headings) instead of line numbers. Context lines anchor modifications.

**Key insight from OpenAI's Codex team:** "Avoiding line numbers" and "clearly delimiting original and replacement code" are the two principles successful systems converge on.

### 6. Two-Model Architecture (Cursor Fast Apply)

A frontier model describes the change in natural language, then a fine-tuned model (Llama-3-70b) rewrites the full file. Uses speculative decoding for ~1000 tokens/sec.

**Status (mid-2025): Considered obsolete.** As argued in "Fast Apply Models are Already Dead": it doubles the failure surface — when the initial model produces vague edits, the apply model must guess. Frontier models are now capable enough to produce exact structured edits directly.

### 7. CRDT-Based Collaborative Editing (Reviso/Pointy)

The LLM works on an offline copy while the user continues editing the live version. Changes are merged using CRDTs.

**Interesting but complex.** Converting markdown back into CRDT operations is significantly harder than expected.

---

## Failure Modes

| Failure Mode                  | Description                                                    | Mitigation                                                        |
| ----------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Line number hallucination** | LLMs cannot reliably produce correct line numbers              | Don't use line numbers. Period.                                   |
| **Exact match failures**      | Whitespace mismatches, trailing spaces, indentation            | Layered matching: exact -> whitespace-insensitive -> fuzzy        |
| **Non-unique matches**        | `old_text` appears multiple times                              | Require uniqueness, return error with context if ambiguous        |
| **Stale context**             | LLM's view of the document is from N turns ago                 | Always include current document state in context                  |
| **Multi-edit ordering**       | Earlier edits shift positions, invalidating later edits        | Apply sequentially, re-resolve each edit against updated state    |
| **Lazy edits**                | Model replaces a section with shortened version or placeholder | Validate output length, use diff format to encourage completeness |
| **Context window saturation** | Full document in context every turn is expensive               | For 1000-5000 word markdown, this is manageable (~2-6k tokens)    |

---

## Recommended Approach

Based on industry convergence, the optimal approach for a markdown writing assistant is **search-and-replace as the primary primitive** with a **full rewrite escape hatch**.

### Proposed Tool Schema

Discriminated unions don't survive conversion to structured outputs / JSON Schema well — providers flatten them in ways that confuse the model. Instead, use a flat object with optional fields. The `type` field determines which optional fields are relevant, and the execute function validates at runtime.

```typescript
const editDocumentTool = tool({
  description: `Edit the current document. You can make multiple edits in a single call.
Each edit has a "type" that determines which fields to provide:
- "replace": Provide old_text and new_text. old_text must be unique in the document. For deletions, set new_text to empty string.
- "insert_after": Provide anchor and new_text. Inserts new_text after the anchor string.
- "rewrite": Provide new_text only. Replaces the entire document (use sparingly, only for major restructuring).

Always use the minimum edit needed — don't rewrite when a replace will do.`,
  parameters: z.object({
    edits: z.array(
      z.object({
        type: z.enum(["replace", "insert_after", "rewrite"]),
        old_text: z
          .string()
          .optional()
          .describe(
            "For 'replace': exact text to find (must be unique in document)"
          ),
        anchor: z
          .string()
          .optional()
          .describe(
            "For 'insert_after': exact text to find as insertion point"
          ),
        new_text: z.string().describe("The new/replacement text"),
      })
    ),
  }),
  execute: async ({ edits }) => {
    // Apply edits sequentially, each against the updated document state
    // Runtime validation: check that required fields are present for each type
    // Return the final document
  },
});
```

### Why This Shape

1. **Flat object with optionals instead of discriminated union.** Discriminated unions (`z.discriminatedUnion`) produce JSON Schema with `oneOf`/`anyOf` that structured output providers handle inconsistently. A single flat object with optional fields and a `type` enum is more reliable — the model sees one clear schema and the `type` field guides which optionals to fill in.

2. **`replace` is the workhorse.** Covers rewrites, deletions, typo fixes, tone changes. This is what Claude Code, Artifacts, Canvas, and Aider all converge on.

3. **`insert_after` for additions.** Adding a new section doesn't fit search-and-replace naturally. An explicit insert operation avoids the awkward pattern of replacing a heading with "heading + new content."

4. **`rewrite` as escape hatch.** For major restructuring or reordering. At 1000-5000 words, a full rewrite is ~2-6k tokens — feasible.

5. **Array of edits.** Multiple edits per turn, applied sequentially. Simpler than batch-applying independent edits.

6. **No line numbers, no regex.** Line numbers are unreliable. Regex adds complexity.

### Simpler Alternative

If failure modes with `insert_after` are a concern (it's one more thing to get wrong), just use a single operation matching Claude Code's approach:

```typescript
z.object({
  old_text: z.string().describe("Text to find and replace"),
  new_text: z.string().describe("Replacement text"),
});
```

For insertions, the LLM replaces a heading/paragraph with itself plus the new content. More tokens but fewer failure modes.

---

## Matching Strategy (Aider's Approach)

When exact matching fails, use layered fallbacks:

1. **Exact match** — find the string verbatim
2. **Whitespace-insensitive** — normalize whitespace before matching
3. **Fuzzy match** — Levenshtein distance / longest common subsequence

RooCode uses a "middle-out" approach: estimate the search region, expand outward, score similarity. This is more robust but adds implementation complexity.

For a markdown writing assistant, **exact match + whitespace-insensitive fallback** is probably sufficient. Fuzzy matching risks applying edits to the wrong location.

---

## Integration with Vercel AI SDK

The codebase uses `Experimental_Agent` from `ai@5.0.93`. Key integration points:

### Adding Tools to the Agent

```typescript
const agent = new Agent({
  model: props.model,
  system: systemPrompt + memorySection,
  tools: {
    editDocument: editDocumentTool,
  },
  stopWhen: stepCountIs(5), // allow multiple edit rounds
});
```

Currently `stopWhen` defaults to `stepCountIs(1)` — must be increased for multi-step editing.

### Streaming Tool Results

The `ToolExecuteFunction` type supports async generators:

```typescript
execute: async function* ({ edits }) {
  for (const edit of edits) {
    // Apply edit...
    yield { status: "editing", appliedEdit: edit };
  }
  yield { status: "complete", content: updatedDocument };
},
```

Intermediate `yield`s are streamed to the client as progress updates. The final yield becomes the tool result sent back to the model.

### Controlling What the Model Sees

The `toModelOutput` property on a tool controls what the model receives as the tool result (vs what the client gets). Useful for sending the full updated document to the client but a summary to the model to save tokens:

```typescript
toModelOutput: (result) => ({
  summary: result.summary,
  wordCount: result.content.split(' ').length,
  // Don't send full document back to model — it'll see it in the next user message
}),
```

### Document State Management

The current document state needs to live somewhere the tool can read and write. Options:

1. **Closure variable** — simplest, store the document as a `let` variable in the scope where the agent is created
2. **Database** — persist edits, enable undo/redo, survive page refreshes
3. **Client state** — send the document to the client via streaming, let the client send it back

Option 1 is the simplest starting point. The document starts as empty (or from a previous save), the tool mutates it, and the final state is returned to the client.

---

## Architecture Sketch

```
User types message
       ↓
Current document state included in context
       ↓
Agent generates tool call: editDocument({ edits: [...] })
       ↓
Tool applies edits to document state
       ↓
Tool returns updated document (streamed to client)
       ↓
Agent sees tool result, decides if more edits needed
       ↓
Agent generates text response ("I've updated the intro paragraph and...")
       ↓
Client renders updated document + AI message
       ↓
User can now manually edit the document
       ↓
Next AI turn includes the user-edited document state
```

---

## Open Questions

1. **Where does the document state live?** In-memory per session? Database? Client-side?
2. **How does the user edit the document?** Raw markdown textarea? Rich editor (Tiptap, BlockNote)? Split pane?
3. **How do we handle undo?** Version history? Git-style? Browser undo?
4. **Should the AI see the full document every turn?** At 1000-5000 words this is fine, but worth considering for longer documents.
5. **How do we handle the initial generation?** First turn uses `rewrite` to create the document from scratch, subsequent turns use `replace`/`insert_after`?

---

## Sources

- [Aider Edit Formats](https://aider.chat/docs/more/edit-formats.html)
- [Aider: Unified diffs make GPT-4 Turbo 3X less lazy](https://aider.chat/docs/unified-diffs.html)
- [Cursor: Instant Apply](https://cursor.com/blog/instant-apply)
- [Fast Apply Models are Already Dead](https://pashpashpash.substack.com/p/fast-apply-models-are-already-dead)
- [Morph: Fast Apply Architectures](https://www.morphllm.com/cursor-fast-apply)
- [Morph: Diff Format Explained](https://www.morphllm.com/edit-formats/diff-format-explained)
- [Code Surgery: How AI Assistants Make Precise Edits](https://fabianhertwig.com/blog/coding-assistants-file-edits/)
- [Context Over Line Numbers](https://medium.com/@surajpotnuru/context-over-line-numbers-a-robust-way-to-apply-llm-code-diffs-eb239e56283f)
- [ChatGPT Canvas system prompt / canmore schema](https://baoyu.io/blog/prompt/full-prompt-chatgpt-4o-with-canvas)
- [LangChain Open Canvas](https://deepwiki.com/langchain-ai/open-canvas)
- [Reinventing the Text Editor for LLMs (Pointy/Reviso)](https://app.pointy.ai/read/0c6954e2-ef5f-481a-b5e9-d036292eda44)
- [Claude Artifacts editing approach](https://hyperdev.matsuoka.com/p/claudeais-quiet-revolution-in-artifact)
- [Vercel AI SDK: Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [Vercel AI SDK: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Tiptap Content AI with Vercel AI SDK](https://tiptap.dev/docs/content-ai/capabilities/agent/custom-llms/server-side-tools/vercel-ai-sdk)

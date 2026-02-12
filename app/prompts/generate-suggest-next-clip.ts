export type FewShotExample = {
  clipTranscripts: string[];
};

const formatFewShotExample = (example: FewShotExample): string => {
  if (example.clipTranscripts.length < 2) {
    return "";
  }

  const contextClips = example.clipTranscripts.slice(0, -1);
  const nextClip = example.clipTranscripts[example.clipTranscripts.length - 1];

  const transcriptLines = contextClips
    .map((text, i) => `Clip ${i + 1}: ${text}`)
    .join("\n");

  return `<example>
<transcript>
${transcriptLines}
</transcript>
<next-clip>
${nextClip}
</next-clip>
</example>`;
};

export const generateSuggestNextClipPrompt = (opts: {
  code: {
    path: string;
    content: string;
  }[];
  transcript: string;
  fewShotExamples?: FewShotExample[];
}) => {
  const transcriptSection = opts.transcript
    ? `Here is the full transcript of the video so far, broken into clips:

<transcript>
${opts.transcript}
</transcript>

`
    : "";

  const codeSection =
    opts.code.length > 0
      ? `Here is the code being taught in this lesson:

<code>
${opts.code
  .map((file) => `<file path="${file.path}">${file.content}</file>`)
  .join("\n")}
</code>

`
      : "";

  const fewShotSection =
    opts.fewShotExamples && opts.fewShotExamples.length > 0
      ? `<few-shot-examples>
Here are examples from real recordings showing the clip-by-clip flow and what came next:

${opts.fewShotExamples.map(formatFewShotExample).filter(Boolean).join("\n\n")}
</few-shot-examples>`
      : "";

  return `
<role-context>
You are a helpful assistant for a course creator who is recording video lessons clip-by-clip.

After each clip is recorded and transcribed, you suggest what the creator should say next. Your suggestions should read like a teleprompter script - the exact words someone would speak aloud.
</role-context>

<documents>
${transcriptSection}${codeSection}</documents>

<the-ask>
Based on the transcript so far, suggest what the course creator should say in their next clip.

Your suggestion should:
- Continue naturally from where the last clip ended
- Be the exact words to say (not stage directions or meta-commentary)
- Sound conversational and natural when read aloud
- Be a reasonable length for a single clip (1-3 sentences typically)
- Progress the lesson logically
- Reference specific code if appropriate
</the-ask>

<output-format>
Output ONLY the spoken words. No quotes, no "you should say...", no stage directions, no markdown formatting.

Just the raw script text as if reading from a teleprompter.
</output-format>

${fewShotSection}
`.trim();
};

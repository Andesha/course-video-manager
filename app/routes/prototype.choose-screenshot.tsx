import { cn } from "@/lib/utils";
import { useState, type HTMLAttributes, useMemo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const hardcodedMarkdown = `
# Screenshot Selector Prototype

Here is some introductory text explaining what's going on.

## Section with a component

Below is an interactive screenshot chooser:

<ChooseScreenshot clipIndex={1} alt="test screenshot" />

And here is some text **after** the component to verify surrounding markdown still renders.

### More markdown features

- List item 1
- List item 2
- List item 3

\`\`\`ts
const x = 1;
console.log(x);
\`\`\`

> A blockquote for good measure
`;

/**
 * Pre-processes AI-generated markdown to convert JSX-style custom component
 * syntax into HTML-compatible syntax that rehype-raw can parse.
 *
 * Converts: <ChooseScreenshot clipIndex={1} alt="test" />
 * Into:     <choosescreenshot clipindex="1" alt="test"></choosescreenshot>
 */
function preprocessMarkdown(md: string): string {
  return md.replace(
    /<ChooseScreenshot\s+([^>]*?)\/>/g,
    (_match, attrs: string) => {
      // Convert JSX-style attributes to HTML-compatible ones
      const htmlAttrs = attrs
        // Convert {value} to "value"
        .replace(/=\{([^}]+)\}/g, '="$1"')
        // Lowercase attribute names
        .replace(
          /([a-zA-Z]+)=/g,
          (_m: string, name: string) => `${name.toLowerCase()}=`
        )
        .trim();
      return `<choosescreenshot ${htmlAttrs}></choosescreenshot>`;
    }
  );
}

function ChooseScreenshot({
  clipindex,
  alt,
}: {
  clipindex?: string;
  alt?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const screenshots = [
    { id: 0, label: "Screenshot A" },
    { id: 1, label: "Screenshot B" },
    { id: 2, label: "Screenshot C" },
  ];

  return (
    <div className="my-4 rounded-lg border border-border bg-muted/50 p-4">
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Choose a screenshot for clip {clipindex ?? "?"} — {alt ?? "no alt text"}
      </p>
      <div className="flex gap-2">
        {screenshots.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm transition-colors",
              selected === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {selected !== null && (
        <p className="mt-2 text-sm text-green-500">
          Selected: {screenshots[selected]?.label}
        </p>
      )}
    </div>
  );
}

const components = {
  choosescreenshot: (
    props: HTMLAttributes<HTMLElement> & Record<string, unknown>
  ) => {
    return (
      <ChooseScreenshot
        clipindex={props.clipindex as string | undefined}
        alt={props.alt as string | undefined}
      />
    );
  },
} as Record<string, unknown> as Options["components"];

export default function PrototypeChooseScreenshot() {
  const processed = useMemo(() => preprocessMarkdown(hardcodedMarkdown), []);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
          components={components}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
        >
          {processed}
        </ReactMarkdown>
      </div>
    </div>
  );
}

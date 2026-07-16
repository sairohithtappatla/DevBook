import { memo } from "react";
import { Markdown } from "@/components/Markdown";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

type PreviewAreaProps = {
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  previewMarkdown: string;
};

export const PreviewArea = memo(function PreviewArea({
  previewContainerRef,
  previewMarkdown,
}: PreviewAreaProps) {
  return (
    <div
      ref={previewContainerRef}
      className="hidden min-w-0 flex-1 flex-col xl:flex overflow-hidden"
    >
      <div className="relative flex items-center justify-between border-b border-hairline bg-surface/40 px-4 py-1.5 shrink-0 select-none">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Preview
        </span>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-8 select-text">
        <div className="mx-auto max-w-2xl">
          <ErrorBoundary>
            <Markdown>{previewMarkdown}</Markdown>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
});

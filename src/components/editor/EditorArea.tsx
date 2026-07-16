import { memo, Suspense, lazy } from "react";
import { Upload } from "lucide-react";

const MDXEditorComponent = lazy(() => import("@/components/editor/MDXEditorComponent"));

type EditorAreaProps = {
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  editorView: "rich" | "raw";
  setEditorView: (view: "rich" | "raw") => void;
  editorRef: any;
  markdown: string;
  handleMarkdownChange: (val: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  imageUploadHandler?: (file: File) => Promise<string>;
  isDraggingFile?: boolean;
};

export const EditorArea = memo(function EditorArea({
  editorContainerRef,
  editorView,
  setEditorView,
  editorRef,
  markdown,
  handleMarkdownChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onPaste,
  imageUploadHandler,
  isDraggingFile,
}: EditorAreaProps) {
  return (
    <div
      ref={editorContainerRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      className="relative flex min-w-0 flex-1 flex-col border-r border-hairline overflow-hidden"
    >
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 border-2 border-dashed border-primary m-2 rounded-lg pointer-events-none">
          <Upload className="h-10 w-10 text-primary animate-bounce mb-2" />
          <span className="text-sm font-semibold">Drop files here to upload</span>
        </div>
      )}
      <div className="relative flex items-center justify-between border-b border-hairline bg-surface/40 px-4 py-1.5 shrink-0 select-none">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Editor
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-3 bg-surface-2 border border-hairline p-0.5 rounded select-none">
          
          <button
            onClick={() => setEditorView("raw")}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
              editorView === "raw"
                ? "bg-white  text-black shadow-xs font-semibold"
                : "bg-black text-white"
            }`}
          >
            Raw Markdown
          </button>

          <button
            onClick={() => setEditorView("rich")}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
              editorView === "rich"
                ? "bg-white  text-black shadow-xs font-semibold"
                : "bg-black text-white "
            }`}
          >
            Visual Editor
          </button>

        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {editorView === "rich" ? (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                Loading editor…
              </div>
            }
          >
            <MDXEditorComponent
              ref={editorRef}
              markdown={markdown}
              onChange={handleMarkdownChange}
              imageUploadHandler={imageUploadHandler}
            />
          </Suspense>
        ) : (
          <textarea
            value={markdown}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            className="scroll-thin h-full w-full resize-none bg-surface p-6 font-mono text-[13px] text-foreground focus:outline-none placeholder-muted-foreground border-none leading-relaxed"
            placeholder="Paste or write your Markdown content here..."
          />
        )}
      </div>
    </div>
  );
});

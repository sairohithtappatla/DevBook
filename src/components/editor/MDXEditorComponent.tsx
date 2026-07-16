import "@mdxeditor/editor/style.css";
import { forwardRef, useEffect, useMemo, useState } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";

type EditorModule = typeof import("@mdxeditor/editor");

let editorModulePromise: Promise<EditorModule> | null = null;

function getEditorModule() {
  editorModulePromise ??= import("prismjs").then(async (prismModule) => {
    const Prism = (prismModule as any).default ?? prismModule;
    // MDXEditor's fallback code renderer reads a global Prism symbol while
    // mounting. Load Prism first, then import the editor package.
    (globalThis as any).Prism = Prism;
    if (typeof window !== "undefined") (window as any).Prism = Prism;
    return await import("@mdxeditor/editor");
  });
  return editorModulePromise;
}

async function uploadImage(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}


type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export const MDXEditorComponent = forwardRef<MDXEditorMethods, Props>(
  ({ markdown, onChange }, ref) => {
    const [editorModule, setEditorModule] = useState<EditorModule | null>(null);

    useEffect(() => {
      let cancelled = false;
      getEditorModule().then((m) => {
        if (!cancelled) setEditorModule(m);
      });
      return () => {
        cancelled = true;
      };
    }, []);

    const plugins = useMemo(() => {
      if (!editorModule) return null;
      const {
        headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin,
        markdownShortcutPlugin, codeBlockPlugin, codeMirrorPlugin,
        linkPlugin, linkDialogPlugin, imagePlugin, tablePlugin,
        toolbarPlugin, UndoRedo, BoldItalicUnderlineToggles, BlockTypeSelect,
        ListsToggle, CreateLink, InsertImage, InsertTable,
        InsertThematicBreak, InsertCodeBlock,
      } = editorModule;

      return [
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        imagePlugin({ imageUploadHandler: uploadImage }),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: "ts" }),
        codeMirrorPlugin({
          codeBlockLanguages: {
            ts: "TypeScript", tsx: "TypeScript React",
            js: "JavaScript", jsx: "JavaScript React",
            bash: "Bash", sh: "Shell", json: "JSON",
            py: "Python", sql: "SQL", rust: "Rust", go: "Go",
            yaml: "YAML", md: "Markdown", mermaid: "Mermaid",
            css: "CSS", html: "HTML", c: "C", cpp: "C++", text: "Plain text",
          },
        }),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <span className="mdx-sep" />
              <BoldItalicUnderlineToggles />
              <span className="mdx-sep" />
              <BlockTypeSelect />
              <span className="mdx-sep" />
              <ListsToggle />
              <span className="mdx-sep" />
              <CreateLink />
              <InsertImage />
              <InsertTable />
              <InsertCodeBlock />
              <InsertThematicBreak />
            </>
          ),
        }),
      ];
    }, [editorModule]);

    if (!editorModule || !plugins) {
      return (
        <div className="grid h-full min-h-[360px] w-full place-items-center text-xs text-text-muted">
          Loading editor…
        </div>
      );
    }

    const { MDXEditor } = editorModule;

    return (
      <div className="devbook-mdx h-full w-full">
        <MDXEditor
          ref={ref}
          markdown={markdown}
          onChange={onChange}
          plugins={plugins}
          contentEditableClassName="mdx-content"
        />
      </div>
    );
  },
);

MDXEditorComponent.displayName = "MDXEditorComponent";
export default MDXEditorComponent;

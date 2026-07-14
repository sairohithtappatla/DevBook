import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export function MDXEditorComponent({ markdown, onChange }: Props) {
  return (
    <div className="w-full h-full mdx-editor-container bg-surface font-sans text-text-primary">
      <MDXEditor
        markdown={markdown}
        onChange={onChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <span className="w-px h-5 bg-border mx-1" />
                <BoldItalicUnderlineToggles />
                <span className="w-px h-5 bg-border mx-1" />
                <BlockTypeSelect />
                <span className="w-px h-5 bg-border mx-1" />
                <ListsToggle />
              </>
            )
          })
        ]}
        contentEditableClassName="prose max-w-none focus:outline-none min-h-[300px] p-4 text-[14px] font-sans leading-relaxed text-text-primary"
      />
    </div>
  );
}
export default MDXEditorComponent;

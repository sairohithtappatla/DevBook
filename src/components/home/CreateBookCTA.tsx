import { Sparkles } from "lucide-react";

type CreateBookCTAProps = {
  onCreateClick?: () => void;
  className?: string;
};

export function CreateBookCTA({ onCreateClick, className = "" }: CreateBookCTAProps) {
  return (
    <div className={`bg-surface-secondary rounded-2xl p-4 mt-2 ${className}`}>
      <div className="space-y-5 text-left">
        <Sparkles className="w-6 h-6 text-text-primary" />
        <div className="space-y-2">
          <h4 className="font-heading text-base font-semibold text-text-primary">
            Create your own book
          </h4>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            Share your knowledge with thousands of developers.
          </p>
        </div>
        <button
          onClick={onCreateClick}
          className="w-fit flex items-center justify-center h-9 px-4 bg-text-primary hover:bg-black/90 text-white rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer mt-1"
        >
          Create Book
        </button>
      </div>
    </div>
  );
}

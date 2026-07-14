import { Sparkles } from "lucide-react";

type CreateBookCTAProps = {
  onCreateClick?: () => void;
  className?: string;
};

export function CreateBookCTA({ onCreateClick, className = "" }: CreateBookCTAProps) {
  return (
    <div className={`bg-white rounded-xl p-3 mt-3  ${className}`}>
      <div className="space-y-5 text-left">
        <Sparkles className="w-8 h-8 text-text-primary" />
        <div className="space-y-3">
          <h4 className="font-heading text-base font-semibold text-text-primary">
            Create your own book
          </h4>
          <p className="font-sans text-xs text-text-secondary leading-relaxed">
            Share your knowledge with thousands of developers.
          </p>
        </div>
        <button
          onClick={onCreateClick}
          className="w-fit flex items-center justify-center h-9 px-4 bg-text-primary hover:bg-black/90 text-white rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer mt-1"
        >
          Create Book
        </button>
      </div>
    </div>
  );
}

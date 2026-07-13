import { BookOpen } from "lucide-react";

type HeroSectionProps = {
  onExploreClick?: () => void;
};

export function HeroSection({ onExploreClick }: HeroSectionProps) {
  return (
    <div className="flex flex-col items-start gap-4 py-2 px-4">
      <div className="w-full max-w-[700px] space-y-1.5">
        <h1 className="font-heading text-[50px] font-bold text-text-primary leading-tight tracking-tight">
          Learn. Build. Ship.
        </h1>
        <p className="font-sans font-semibold text-sm ">
          DevBook is a collection of in-depth developer guides crafted and loved by developers.
          <br />
          Convert AI roadmaps into interactive, real-time structured developer documentation.
        </p>
      </div>

      <div className="flex items-center shrink-0 mt-1">
        <button
          onClick={onExploreClick}
          className="flex items-center gap-2 h-11 px-5 bg-black hover:bg-black/90 text-white rounded-md text-sm font-semibold transition-colors duration-150 cursor-pointer w-auto justify-center"
        >
          <BookOpen className="w-4 h-4" />
          Explore Books
        </button>
      </div>
    </div>
  );
}

import { useAllProfiles } from "@/hooks/useProfile";
import { useBooks } from "@/hooks/useBooks";

export type CreatorData = {
  id: string;
  name: string;
  avatar_url?: string;
  booksCount: number;
};

type TopCreatorsWidgetProps = {
  className?: string;
};

export function TopCreatorsWidget({ className = "" }: TopCreatorsWidgetProps) {
  const { data: dbProfiles = [] } = useAllProfiles();
  const { data: dbBooks = [] } = useBooks();

  const creators = dbProfiles
    .map((profile) => {
      const count = dbBooks.filter((b) => b.created_by === profile.id).length;
      return {
        id: profile.id,
        name: profile.name || "DevBook User",
        avatar_url: profile.avatar_url || undefined,
        booksCount: count
      };
    })
    .sort((a, b) => b.booksCount - a.booksCount)
    .slice(0, 3); // show top 3 creators
  return (
    <div className={`space-y-1 ${className}`}>
      <h3 className="font-heading text-base font-semibold text-text-primary select-none px-2">
        Top Creators
      </h3>
      <div className="space-y-3 px-1">
        {creators.map((creator) => (
          <div key={creator.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {creator.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={creator.name}
                  className="w-7 h-7 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-surface-secondary text-text-primary border border-border flex items-center justify-center font-heading font-semibold text-xs shrink-0 select-none">
                  {creator.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-sans text-sm font-medium text-text-primary truncate">
                {creator.name}
              </span>
            </div>
            <span className="font-sans text-[13px] text-text-muted shrink-0">
              {creator.booksCount} books
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

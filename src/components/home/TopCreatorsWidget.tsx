import { useAllProfiles } from "@/hooks/useProfile";
import { useBooks } from "@/hooks/useBooks";
import { useNavigate } from "@tanstack/react-router";

export type CreatorData = {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
  booksCount: number;
};

type TopCreatorsWidgetProps = {
  className?: string;
};

export function TopCreatorsWidget({ className = "" }: TopCreatorsWidgetProps) {
  const { data: dbProfiles = [] } = useAllProfiles();
  const { data: dbBooks = [] } = useBooks();
  const navigate = useNavigate();

  const creators = dbProfiles
    .map((profile) => {
      const count = dbBooks.filter((b) => b.created_by === profile.id).length;
      
      let username = (profile.name || "user").toLowerCase().replace(/\s+/g, "_");
      try {
        if (profile.bio?.startsWith("{")) {
          const parsed = JSON.parse(profile.bio);
          if (parsed.username) {
            username = parsed.username;
          }
        }
      } catch (e) {
        // Ignore
      }

      return {
        id: profile.id,
        name: profile.name || "DevBook User",
        username,
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
            <div
              onClick={() => navigate({ to: "/profile", search: { username: creator.username } })}
              className="flex items-center gap-3 min-w-0 cursor-pointer group"
            >
              {creator.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={creator.name}
                  className="w-7 h-7 rounded-full object-cover border border-border group-hover:border-primary/50 transition-colors"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-surface-secondary text-text-primary border border-border flex items-center justify-center font-heading font-semibold text-xs shrink-0 select-none group-hover:border-primary/50 transition-colors">
                  {creator.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-sans text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">
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

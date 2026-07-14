export type CreatorData = {
  id: string;
  name: string;
  avatar_url?: string;
  booksCount: number;
};

type TopCreatorsWidgetProps = {
  creators?: CreatorData[];
  className?: string;
};

const defaultCreators: CreatorData[] = [
  {
    id: "1",
    name: "Rohith",
    booksCount: 12,
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80",
  },
  {
    id: "2",
    name: "Ananya",
    booksCount: 9,
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80",
  },
  {
    id: "3",
    name: "Sai Kiran",
    booksCount: 8,
    avatar_url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&h=80&q=80",
  },
];

export function TopCreatorsWidget({ creators = defaultCreators, className = "" }: TopCreatorsWidgetProps) {
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

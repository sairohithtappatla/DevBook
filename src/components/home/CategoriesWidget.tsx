type CategoriesWidgetProps = {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categories?: string[];
  className?: string;
  layout?: "vertical-responsive" | "horizontal";
  showTitle?: boolean;
};

const defaultCategories = [
  "All",
  "Backend",
  "DevOps",
  "System Design",
  "Databases",
  "API Design",
  "Architecture",
];

export function CategoriesWidget({
  selectedCategory,
  onSelectCategory,
  categories = defaultCategories,
  className = "",
  layout = "vertical-responsive",
  showTitle = true,
}: CategoriesWidgetProps) {
  const isHorizontal = layout === "horizontal";
  
  return (
    <div className={`${showTitle ? "space-y-1" : ""} ${className}`}>
      {showTitle && (
        <h3 className="font-body text-sm font-semibold text-text-primary select-none px-1 tracking-tight">
          Categories
        </h3>
      )}
      <div 
        className={`flex flex-row overflow-x-auto gap-0.5 scroll-smooth custom-scrollbar ${
          isHorizontal 
            ? "pb-0 w-full sm:w-auto" 
            : "pb-2 md:pb-0 md:flex-col md:overflow-x-visible md:space-y-0.5"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`px-2.5 py-0.5 rounded-lg text-sm leading-none h-7 font-body tracking-tight transition-all duration-150 cursor-pointer shrink-0 text-center ${
                isHorizontal ? "w-auto" : "text-left w-auto md:w-full"
              } ${
                isActive
                  ? isHorizontal
                    ? "bg-black text-white dark:bg-white dark:text-black font-semibold"
                    : "bg-surface-secondary text-text-primary font-semibold"
                  : "text-text-secondary hover:bg-surface-secondary/50 hover:text-text-primary"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}

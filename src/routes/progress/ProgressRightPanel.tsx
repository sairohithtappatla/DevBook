import { ChevronLeft, ChevronRight, Trophy, Zap, BookOpen } from "lucide-react";

export function ProgressRightPanel() {
  // Calendar days for May 2025
  const calendarDays = [
    { day: 28, isCurrentMonth: false, activity: "none" },
    { day: 29, isCurrentMonth: false, activity: "none" },
    { day: 30, isCurrentMonth: false, activity: "none" },
    { day: 1, isCurrentMonth: true, activity: "little" },
    { day: 2, isCurrentMonth: true, activity: "good" },
    { day: 3, isCurrentMonth: true, activity: "little" },
    { day: 4, isCurrentMonth: true, activity: "none" },
    
    { day: 5, isCurrentMonth: true, activity: "none" },
    { day: 6, isCurrentMonth: true, activity: "none" },
    { day: 7, isCurrentMonth: true, activity: "none" },
    { day: 8, isCurrentMonth: true, activity: "good" },
    { day: 9, isCurrentMonth: true, activity: "none" },
    { day: 10, isCurrentMonth: true, activity: "none" },
    { day: 11, isCurrentMonth: true, activity: "none" },
    
    { day: 12, isCurrentMonth: true, activity: "none" },
    { day: 13, isCurrentMonth: true, activity: "none" },
    { day: 14, isCurrentMonth: true, activity: "none" },
    { day: 15, isCurrentMonth: true, activity: "none" },
    { day: 16, isCurrentMonth: true, activity: "none" },
    { day: 17, isCurrentMonth: true, activity: "little" },
    { day: 18, isCurrentMonth: true, activity: "little" },
    
    { day: 19, isCurrentMonth: true, activity: "none" },
    { day: 20, isCurrentMonth: true, activity: "great" },
    { day: 21, isCurrentMonth: true, activity: "none" },
    { day: 22, isCurrentMonth: true, activity: "little" },
    { day: 23, isCurrentMonth: true, activity: "none" },
    { day: 24, isCurrentMonth: true, activity: "none" },
    { day: 25, isCurrentMonth: true, activity: "none" },
    
    { day: 26, isCurrentMonth: true, activity: "none" },
    { day: 27, isCurrentMonth: true, activity: "great" },
    { day: 28, isCurrentMonth: true, activity: "little" },
    { day: 29, isCurrentMonth: true, activity: "good" },
    { day: 30, isCurrentMonth: true, activity: "none" },
    { day: 31, isCurrentMonth: true, activity: "none" },
    { day: 1, isCurrentMonth: false, activity: "none" }
  ];

  const getCalendarCellClass = (item: typeof calendarDays[0]) => {
    if (!item.isCurrentMonth) {
      return "text-text-muted text-[11px] font-sans h-7 w-7 flex items-center justify-center";
    }
    
    const base = "text-[11px] font-sans font-medium h-7 w-7 flex items-center justify-center rounded-md transition-colors select-none";
    switch (item.activity) {
      case "little":
        return `${base} bg-[#DCFCE7] dark:bg-green-950/40 text-[#15803D] dark:text-green-400 hover:bg-green-200/70`;
      case "good":
        return `${base} bg-[#22C55E] text-white hover:bg-green-600`;
      case "great":
        return `${base} bg-[#15803D] text-white hover:bg-green-800`;
      default:
        return `${base} text-text-primary hover:bg-surface-secondary`;
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full w-full select-none justify-between overflow-hidden">
      {/* 1. Learning Calendar Card */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-xs flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40 shrink-0">
          <span className="font-heading text-[12px] font-bold text-text-primary">Learning Calendar</span>
          <div className="flex items-center gap-1">
            <button className="p-0.5 rounded hover:bg-surface-secondary text-text-secondary cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-sans text-[10px] font-semibold text-text-primary px-0.5">May 2025</span>
            <button className="p-0.5 rounded hover:bg-surface-secondary text-text-secondary cursor-pointer">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[9px] font-bold text-text-muted py-1.5 uppercase tracking-wider shrink-0">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 justify-items-center flex-1 items-center">
          {calendarDays.map((item, idx) => (
            <div key={idx} className={getCalendarCellClass(item)}>
              {item.day}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between pt-2.5 mt-1.5 border-t border-border/40 text-[9px] text-text-secondary font-medium font-sans shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-border" />
            <span>No activity</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DCFCE7] dark:bg-green-900/60" />
            <span>Little</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span>Good</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
            <span>Great</span>
          </div>
        </div>
      </div>

      {/* 2. Progress Overview Card */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-xs flex-1 flex flex-col justify-between">
        <h4 className="font-heading text-[12px] font-bold text-text-primary pb-2.5 border-b border-border/40 mb-2 shrink-0">Progress Overview</h4>
        
        <div className="flex items-center gap-4 justify-between flex-1">
          {/* Donut Chart (SVG) */}
          <div className="relative w-[76px] h-[76px] flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="var(--color-border)"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="#16A34A"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="79 213.6"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="#2563EB"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="106.8 213.6"
                strokeDashoffset="-79"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none leading-none">
              <span className="text-[14px] font-bold font-heading text-text-primary">103</span>
              <span className="text-[8.5px] text-text-secondary mt-0.5">steps</span>
            </div>
          </div>

          {/* Details Legend */}
          <div className="flex-1 flex flex-col gap-1.5 text-[10px] font-sans text-text-secondary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                <span>Completed</span>
              </div>
              <span className="font-semibold text-text-primary">38 (37%)</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                <span>In Progress</span>
              </div>
              <span className="font-semibold text-text-primary">52 (50%)</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-border" />
                <span>Not Started</span>
              </div>
              <span className="font-semibold text-text-primary">13 (13%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recent Achievements Card */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-xs flex flex-col shrink-0">
        <h4 className="font-heading text-[12px] font-bold text-text-primary pb-2.5 border-b border-border/40 mb-3 shrink-0">Recent Achievements</h4>
        
        <div className="flex flex-col gap-3">
          {/* Consistency Champion */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11.5px] font-semibold text-text-primary truncate">Consistency Champion</span>
              <span className="text-[9px] text-text-secondary">7 days in a row</span>
            </div>
          </div>

          {/* Quick Learner */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11.5px] font-semibold text-text-primary truncate">Quick Learner</span>
              <span className="text-[9px] text-text-secondary">Completed 5 steps in a day</span>
            </div>
          </div>

          {/* Book Explorer */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11.5px] font-semibold text-text-primary truncate">Book Explorer</span>
              <span className="text-[9px] text-text-secondary">Started 5 books</span>
            </div>
          </div>
        </div>

        {/* View All achievements link */}
        <button className="text-left text-[10px] font-bold text-primary hover:text-primary-hover hover:underline transition-colors mt-3 pt-2.5 border-t border-border/40 flex items-center gap-1 cursor-pointer shrink-0">
          <span>View all achievements</span>
          <span className="text-xs">&rarr;</span>
        </button>
      </div>
    </div>
  );
}

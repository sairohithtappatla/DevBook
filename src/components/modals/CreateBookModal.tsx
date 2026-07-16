import { useState, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  isPending?: boolean;
  onCreateBook: (book: {
    title: string;
    description: string;
    category: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    coverType: string;
  }) => void;
};

export function CreateBookModal({ isOpen, onClose, isPending = false, onCreateBook }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Backend");
  const [difficulty, setDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [coverType, setCoverType] = useState("workflow");

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setCategory("Backend");
      setDifficulty("Beginner");
      setCoverType("workflow");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isPending) return;
    
    onCreateBook({
      title: title.trim(),
      description: description.trim() || "",
      category,
      difficulty,
      coverType
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Modal Card */}
      <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">Create New Book</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-secondary text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-semibold text-text-secondary select-text">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Book Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Docker Deep Dive, Redis Mastery"
              className="w-full h-9 border border-border rounded-lg px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a brief summary of the book content..."
              className="w-full h-20 border border-border rounded-lg p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-text-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 border border-border rounded-lg px-2 text-xs font-medium bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="Backend">Backend</option>
                <option value="DevOps">DevOps</option>
                <option value="System Design">System Design</option>
                <option value="Databases">Databases</option>
                <option value="API Design">API Design</option>
                <option value="Architecture">Architecture</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full h-9 border border-border rounded-lg px-2 text-xs font-medium bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>



          {/* Footer CTA */}
          <div className="pt-3 border-t border-border flex justify-end gap-2.5 select-none">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer font-bold disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default CreateBookModal;

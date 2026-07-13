import { BookCard } from "./BookCard";
import type { BookData } from "./BookCard";

type BookGridProps = {
  books: BookData[];
  onBookClick?: (book: BookData) => void;
  className?: string;
};

export function BookGrid({ books, onBookClick, className = "" }: BookGridProps) {
  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface border border-dashed border-border rounded-xl text-center">
        <p className="font-body text-text-secondary text-sm">No books found matching the selection.</p>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}
    >
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={() => onBookClick?.(book)} />
      ))}
    </div>
  );
}

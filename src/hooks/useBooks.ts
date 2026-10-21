import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService, type DBBook } from "@/services/db";
import type { ReaderTree } from "@/lib/reader-tree";

export function useBooks() {
  return useQuery<DBBook[]>({
    queryKey: ["books"],
    queryFn: () => DBService.getBooks(),
  });
}

export function useBookStepCounts(bookIds: string[], opts: { includeDrafts?: boolean } = {}) {
  const includeDrafts = !!opts.includeDrafts;
  return useQuery<Record<string, number>>({
    queryKey: ["book-step-counts", bookIds, includeDrafts],
    queryFn: () => DBService.getStepCounts(bookIds, { includeDrafts }),
    enabled: bookIds.length > 0,
  });
}

// One request for the reader: book, creator and visible structure. Key starts with ["book-structure", id] so the
// existing invalidation of that prefix also refreshes it. staleTime 0: access rules and publication state can change.
export function useReaderBook(bookId: string | null) {
  return useQuery<ReaderTree | null>({
    queryKey: ["book-structure", bookId, "reader-tree"],
    queryFn: () => (bookId ? DBService.getReaderTree(bookId, true) : Promise.resolve(null)),
    enabled: !!bookId,
    staleTime: 0,
    gcTime: 0, // drop the tree (it may hold drafts for OWNER/EDITOR/REVIEWER) as soon as no page uses it, so it is never shown to the next user of the browser
  });
}

export function useBook(bookId: string | null) {
  return useQuery<DBBook | null>({
    queryKey: ["book", bookId],
    queryFn: () => (bookId ? DBService.getBook(bookId) : Promise.resolve(null)),
    enabled: !!bookId,
  });
}

export function useBookBySlug(slug: string | null) {
  return useQuery<DBBook | null>({
    queryKey: ["book-slug", slug],
    queryFn: () => (slug ? DBService.getBookBySlug(slug) : Promise.resolve(null)),
    enabled: !!slug,
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newBook: Omit<DBBook, "id" | "created_by">) => DBService.createBook(newBook),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, updates }: { bookId: string; updates: Partial<Omit<DBBook, "id">> }) =>
      DBService.updateBook(bookId, updates),
    onMutate: async ({ bookId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["book", bookId] });
      await queryClient.cancelQueries({ queryKey: ["books"] });

      const previousBook = queryClient.getQueryData<DBBook>(["book", bookId]);
      const previousBooks = queryClient.getQueryData<DBBook[]>(["books"]);

      if (previousBook) {
        queryClient.setQueryData<DBBook>(["book", bookId], {
          ...previousBook,
          ...updates,
        });
      }

      if (previousBooks) {
        queryClient.setQueryData<DBBook[]>(["books"], (old) => {
          if (!old) return [];
          return old.map((b) => (b.id === bookId ? { ...b, ...updates } : b));
        });
      }

      return { previousBook, previousBooks };
    },
    onError: (_err, variables, context: any) => {
      if (context?.previousBook) {
        queryClient.setQueryData(["book", variables.bookId], context.previousBook);
      }
      if (context?.previousBooks) {
        queryClient.setQueryData(["books"], context.previousBooks);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["book", variables.bookId], data);
      if (variables.updates.slug) {
        queryClient.invalidateQueries({ queryKey: ["book-slug", variables.updates.slug] });
      }
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => DBService.deleteBook(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useBookStructure(bookId: string | null, isReaderView = false) {
  return useQuery({
    queryKey: ["book-structure", bookId, isReaderView ? "reader" : "editor"],
    queryFn: () => (bookId ? DBService.getBookStructure(bookId, isReaderView) : Promise.resolve([])),
    enabled: !!bookId,
  });
}

// --- PHASES ---
export function useBookPhases(bookId: string | null) {
  return useQuery({
    queryKey: ["phases", bookId],
    queryFn: () => (bookId ? DBService.getPhases(bookId) : Promise.resolve([])),
    enabled: !!bookId,
  });
}

export function useCreatePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newPhase: { book_id: string; title: string; position: number }) =>
      DBService.createPhase(newPhase),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["phases", variables.book_id], (old: any) => {
        if (!old) return [data];
        return [...old, data];
      });
      queryClient.invalidateQueries({ queryKey: ["book-structure", variables.book_id] });
      queryClient.invalidateQueries({ queryKey: ["phases", variables.book_id] });
    },
  });
}

export function useUpdatePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, updates }: { phaseId: string; bookId: string; updates: { title?: string; position?: number } }) =>
      DBService.updatePhase(phaseId, updates),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["phases", variables.bookId], (old: any) => {
        if (!old) return [];
        return old.map((p: any) => (p.id === variables.phaseId ? { ...p, ...data } : p));
      });
      queryClient.invalidateQueries({ queryKey: ["book-structure", variables.bookId] });
      queryClient.invalidateQueries({ queryKey: ["phases", variables.bookId] });
    },
  });
}

export function useDeletePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId }: { phaseId: string; bookId: string }) =>
      DBService.deletePhase(phaseId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-structure", variables.bookId] });
      queryClient.invalidateQueries({ queryKey: ["phases", variables.bookId] });
    },
  });
}

// --- STEPS ---
export function usePhaseSteps(phaseId: string | null) {
  return useQuery({
    queryKey: ["steps", phaseId],
    queryFn: () => (phaseId ? DBService.getSteps(phaseId) : Promise.resolve([])),
    enabled: !!phaseId,
  });
}

export function useCreateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newStep: { phase_id: string; title: string; position: number; content: any; bookId?: string }) =>
      DBService.createStep({ phase_id: newStep.phase_id, title: newStep.title, position: newStep.position, content: newStep.content }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["steps", variables.phase_id] });
      if (variables.bookId) {
        queryClient.invalidateQueries({ queryKey: ["book-structure", variables.bookId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["book-structure"] });
      }
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, updates }: { stepId: string; phaseId: string; bookId?: string; updates: { title?: string; position?: number; content?: any } }) =>
      DBService.updateStep(stepId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["steps", variables.phaseId] });
      if (variables.bookId) {
        queryClient.invalidateQueries({ queryKey: ["book-structure", variables.bookId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["book-structure"] });
      }
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId }: { stepId: string; phaseId: string; bookId?: string }) =>
      DBService.deleteStep(stepId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["steps", variables.phaseId] });
      if (variables.bookId) {
        queryClient.invalidateQueries({ queryKey: ["book-structure", variables.bookId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["book-structure"] });
      }
    },
  });
}

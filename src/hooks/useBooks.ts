import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService, type DBBook } from "@/services/db";

export function useBooks() {
  return useQuery<DBBook[]>({
    queryKey: ["books"],
    queryFn: () => DBService.getBooks(),
  });
}

export function useBookStepCounts(bookIds: string[]) {
  return useQuery<Record<string, number>>({
    queryKey: ["book-step-counts", bookIds],
    queryFn: () => DBService.getStepCounts(bookIds),
    enabled: bookIds.length > 0,
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

export function useBookStructure(bookId: string | null) {
  return useQuery({
    queryKey: ["book-structure", bookId],
    queryFn: () => (bookId ? DBService.getBookStructure(bookId) : Promise.resolve([])),
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
      queryClient.setQueryData(["book-structure", variables.book_id], (old: any) => {
        const newPhaseNode = { ...data, steps: [] };
        if (!old) return [newPhaseNode];
        return [...old, newPhaseNode];
      });
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
      queryClient.setQueryData(["book-structure", variables.bookId], (old: any) => {
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
      queryClient.setQueryData(["phases", variables.bookId], (old: any) => {
        if (!old) return [];
        return old.filter((p: any) => p.id !== variables.phaseId);
      });
      queryClient.setQueryData(["book-structure", variables.bookId], (old: any) => {
        if (!old) return [];
        return old.filter((p: any) => p.id !== variables.phaseId);
      });
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
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["steps", variables.phase_id], (old: any) => {
        if (!old) return [data];
        return [...old, data];
      });
      if (variables.bookId) {
        queryClient.setQueryData(["book-structure", variables.bookId], (old: any) => {
          if (!old) return [];
          return old.map((phase: any) => {
            if (phase.id === variables.phase_id) {
              const content = data.content || {};
              const stepNode = {
                id: data.id,
                title: data.title,
                slug: content.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                markdown: content.markdown || "",
                description: content.description || "",
                status: content.status || "Draft",
                estimatedTime: content.estimatedTime || 10,
                difficulty: content.difficulty || "Beginner",
                visibility: content.visibility || "Public",
              };
              return {
                ...phase,
                steps: [...(phase.steps || []), stepNode],
              };
            }
            return phase;
          });
        });
      }
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, updates }: { stepId: string; phaseId: string; bookId?: string; updates: { title?: string; position?: number; content?: any } }) =>
      DBService.updateStep(stepId, updates),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["steps", variables.phaseId], (old: any) => {
        if (!old) return [];
        return old.map((s: any) => (s.id === variables.stepId ? { ...s, ...data } : s));
      });
      if (variables.bookId) {
        queryClient.setQueryData(["book-structure", variables.bookId], (old: any) => {
          if (!old) return [];
          return old.map((phase: any) => {
            if (phase.id === variables.phaseId) {
              return {
                ...phase,
                steps: (phase.steps || []).map((s: any) => {
                  if (s.id === variables.stepId) {
                    const content = data.content || {};
                    return {
                      ...s,
                      title: data.title || s.title,
                      slug: content.slug || s.slug,
                      markdown: content.markdown !== undefined ? content.markdown : s.markdown,
                      description: content.description !== undefined ? content.description : s.description,
                      status: content.status || s.status,
                      estimatedTime: content.estimatedTime || s.estimatedTime,
                      difficulty: content.difficulty || s.difficulty,
                      visibility: content.visibility || s.visibility,
                    };
                  }
                  return s;
                }),
              };
            }
            return phase;
          });
        });
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
      queryClient.setQueryData(["steps", variables.phaseId], (old: any) => {
        if (!old) return [];
        return old.filter((s: any) => s.id !== variables.stepId);
      });
      if (variables.bookId) {
        queryClient.setQueryData(["book-structure", variables.bookId], (old: any) => {
          if (!old) return [];
          return old.map((phase: any) => {
            if (phase.id === variables.phaseId) {
              return {
                ...phase,
                steps: (phase.steps || []).filter((s: any) => s.id !== variables.stepId),
              };
            }
            return phase;
          });
        });
      }
    },
  });
}

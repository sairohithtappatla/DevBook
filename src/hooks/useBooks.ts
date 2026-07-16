import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService, type DBBook } from "@/services/db";

export function useBooks() {
  return useQuery<DBBook[]>({
    queryKey: ["books"],
    queryFn: () => DBService.getBooks(),
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
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["book", variables.bookId] });
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
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["phases", variables.book_id] });
      queryClient.invalidateQueries({ queryKey: ["book-structure"] });
    },
  });
}

export function useUpdatePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, updates }: { phaseId: string; bookId: string; updates: { title?: string; position?: number } }) =>
      DBService.updatePhase(phaseId, updates),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["phases", variables.bookId] });
      queryClient.invalidateQueries({ queryKey: ["book-structure"] });
    },
  });
}

export function useDeletePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId }: { phaseId: string; bookId: string }) =>
      DBService.deletePhase(phaseId),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["phases", variables.bookId] });
      queryClient.invalidateQueries({ queryKey: ["book-structure"] });
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
    mutationFn: (newStep: { phase_id: string; title: string; position: number; content: any }) =>
      DBService.createStep(newStep),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["steps", variables.phase_id] });
      queryClient.invalidateQueries({ queryKey: ["book-structure"] });
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, updates }: { stepId: string; phaseId: string; updates: { title?: string; position?: number; content?: any } }) =>
      DBService.updateStep(stepId, updates),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["steps", variables.phaseId] });
      queryClient.invalidateQueries({ queryKey: ["book-structure"] });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId }: { stepId: string; phaseId: string }) =>
      DBService.deleteStep(stepId),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["steps", variables.phaseId] });
      queryClient.invalidateQueries({ queryKey: ["book-structure"] });
    },
  });
}

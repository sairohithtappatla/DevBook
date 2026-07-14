import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService } from "@/services/db";

export function useBookProgress(userId: string | undefined, bookId: string | undefined) {
  return useQuery({
    queryKey: ["book-progress", userId, bookId],
    queryFn: () =>
      userId && bookId ? DBService.getBookProgress(userId, bookId) : Promise.resolve(null),
    enabled: !!userId && !!bookId,
  });
}

export function useStepProgresses(userId: string | undefined) {
  return useQuery({
    queryKey: ["step-progresses", userId],
    queryFn: () => (userId ? DBService.getStepProgresses(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useStartBookProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, bookId }: { userId: string; bookId: string }) =>
      DBService.startBookProgress(userId, bookId),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["book-progress", variables.userId, variables.bookId] });
    },
  });
}

export function useUpdateBookProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      bookId,
      updates,
    }: {
      userId: string;
      bookId: string;
      updates: { progress_percentage: number; last_read_step_id?: string | null };
    }) => DBService.updateBookProgress(userId, bookId, updates),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["book-progress", variables.userId, variables.bookId] });
    },
  });
}

export function useUpdateStepProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      stepId,
      status,
    }: {
      userId: string;
      stepId: string;
      status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    }) => DBService.updateStepProgress(userId, stepId, status),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["step-progresses", variables.userId] });
    },
  });
}

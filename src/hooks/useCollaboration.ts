import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService, type DBBookMember } from "@/services/db";

export function useBookMembers(bookId: string | null) {
  return useQuery<DBBookMember[]>({
    queryKey: ["book-members", bookId],
    queryFn: () => (bookId ? DBService.getBookMembers(bookId) : Promise.resolve([])),
    enabled: !!bookId,
  });
}

export function useAddBookMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookId,
      userId,
      role,
    }: {
      bookId: string;
      userId: string;
      role: "OWNER" | "EDITOR" | "VIEWER";
    }) => DBService.addBookMember(bookId, userId, role),
    onSuccess: (data: any, variables: any) => {
      queryClient.setQueryData(["book-members", variables.bookId], (old: any) => {
        if (!old) return [data];
        return [...old, data];
      });
    },
  });
}

export function useRemoveBookMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, userId }: { bookId: string; userId: string }) =>
      DBService.removeBookMember(bookId, userId),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["book-members", variables.bookId], (old: any) => {
        if (!old) return [];
        return old.filter((m: any) => m.user_id !== variables.userId);
      });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService, type DBUser } from "@/services/db";

export function useProfile(userId: string | undefined) {
  return useQuery<DBUser | null>({
    queryKey: ["profile", userId],
    queryFn: () => (userId ? DBService.getProfile(userId) : Promise.resolve(null)),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: Partial<Omit<DBUser, "id">> }) =>
      DBService.updateProfile(userId, updates),
    onMutate: async ({ userId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["profile", userId] });
      const previousProfile = queryClient.getQueryData<DBUser>(["profile", userId]);

      if (previousProfile) {
        queryClient.setQueryData<DBUser>(["profile", userId], {
          ...previousProfile,
          ...updates,
        });
      }

      return { previousProfile };
    },
    onError: (_err, variables, context: any) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(["profile", variables.userId], context.previousProfile);
      }
    },
    onSuccess: (data: any, variables: any) => {
      queryClient.setQueryData(["profile", variables.userId], data);
      queryClient.setQueryData(["profiles"], (old: any) => {
        if (!old) return [data];
        return old.map((p: any) => (p.id === variables.userId ? data : p));
      });
    },
  });
}

export function useAllProfiles() {
  return useQuery<DBUser[]>({
    queryKey: ["profiles"],
    queryFn: () => DBService.getAllProfiles(),
  });
}

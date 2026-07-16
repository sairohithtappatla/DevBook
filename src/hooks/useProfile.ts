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
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["profile", variables.userId] });
    },
  });
}

export function useAllProfiles() {
  return useQuery<DBUser[]>({
    queryKey: ["profiles"],
    queryFn: () => DBService.getAllProfiles(),
  });
}

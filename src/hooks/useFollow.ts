import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService, type DBUser } from "@/services/db";

export function useFollowers(userId: string | undefined) {
  return useQuery<DBUser[]>({
    queryKey: ["followers", userId],
    queryFn: () => (userId ? DBService.getFollowers(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useFollowing(userId: string | undefined) {
  return useQuery<DBUser[]>({
    queryKey: ["following", userId],
    queryFn: () => (userId ? DBService.getFollowing(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useFollowUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ followerId, followingId }: { followerId: string; followingId: string }) =>
      DBService.followUser(followerId, followingId),
    onMutate: async ({ followerId, followingId }) => {
      await queryClient.cancelQueries({ queryKey: ["following", followerId] });
      await queryClient.cancelQueries({ queryKey: ["followers", followingId] });

      const previousFollowing = queryClient.getQueryData<DBUser[]>(["following", followerId]);
      const previousFollowers = queryClient.getQueryData<DBUser[]>(["followers", followingId]);

      // Attempt to look up profile info from the current profiles query cache
      const allProfiles = queryClient.getQueryData<DBUser[]>(["profiles"]) || [];
      const followerProfile = allProfiles.find((p) => p.id === followerId);
      const followingProfile = allProfiles.find((p) => p.id === followingId);

      if (followingProfile) {
        queryClient.setQueryData<DBUser[]>(["following", followerId], (old) => {
          if (!old) return [followingProfile];
          if (old.some((u) => u.id === followingId)) return old;
          return [...old, followingProfile];
        });
      }

      if (followerProfile) {
        queryClient.setQueryData<DBUser[]>(["followers", followingId], (old) => {
          if (!old) return [followerProfile];
          if (old.some((u) => u.id === followerId)) return old;
          return [...old, followerProfile];
        });
      }

      return { previousFollowing, previousFollowers };
    },
    onError: (_err, variables, context: any) => {
      if (context?.previousFollowing) {
        queryClient.setQueryData(["following", variables.followerId], context.previousFollowing);
      }
      if (context?.previousFollowers) {
        queryClient.setQueryData(["followers", variables.followingId], context.previousFollowers);
      }
    },
  });
}

export function useUnfollowUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ followerId, followingId }: { followerId: string; followingId: string }) =>
      DBService.unfollowUser(followerId, followingId),
    onMutate: async ({ followerId, followingId }) => {
      await queryClient.cancelQueries({ queryKey: ["following", followerId] });
      await queryClient.cancelQueries({ queryKey: ["followers", followingId] });

      const previousFollowing = queryClient.getQueryData<DBUser[]>(["following", followerId]);
      const previousFollowers = queryClient.getQueryData<DBUser[]>(["followers", followingId]);

      queryClient.setQueryData<DBUser[]>(["following", followerId], (old) => {
        if (!old) return [];
        return old.filter((u) => u.id !== followingId);
      });

      queryClient.setQueryData<DBUser[]>(["followers", followingId], (old) => {
        if (!old) return [];
        return old.filter((u) => u.id !== followerId);
      });

      return { previousFollowing, previousFollowers };
    },
    onError: (_err, variables, context: any) => {
      if (context?.previousFollowing) {
        queryClient.setQueryData(["following", variables.followerId], context.previousFollowing);
      }
      if (context?.previousFollowers) {
        queryClient.setQueryData(["followers", variables.followingId], context.previousFollowers);
      }
    },
  });
}

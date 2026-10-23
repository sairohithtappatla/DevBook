import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { McpService, type McpConnections } from "@/services/mcp.service";
import type { McpScope } from "@/lib/mcp-connect";

const KEY = ["mcp-connections"];

export function useMcpConnections() {
  return useQuery<McpConnections>({
    queryKey: KEY,
    queryFn: () => McpService.myConnections(),
    staleTime: 0,
  });
}

export function useCreatePersonalToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; prefix: string; hash: string; scopes: McpScope[]; days: number }) =>
      McpService.createPersonalToken(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokePersonalToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => McpService.revokePersonalToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeMcpApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => McpService.revokeApp(grantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

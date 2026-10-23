import { insforge } from "@/lib/insforge";
import type { McpScope } from "@/lib/mcp-connect";

// Database functions from mcp/devbook-mcp/sql/003_mcp_oauth.sql. Each acts on the signed-in user only.
export type McpPersonalToken = {
  id: string;
  label: string;
  prefix: string;
  scopes: McpScope[];
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
};
export type McpConnectedApp = {
  id: string;
  client_name: string;
  client_uri: string | null;
  redirect_uris: string[];
  scopes: McpScope[];
  created_at: string;
  last_used_at: string | null;
};
export type McpConnections = { tokens: McpPersonalToken[]; apps: McpConnectedApp[] };
export type OAuthClientInfo = { client_name: string; client_uri: string | null; redirect_ok: boolean };

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await insforge.database.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const McpService = {
  async myConnections(): Promise<McpConnections> {
    const data = await rpc<McpConnections | null>("mcp_my_connections");
    return { tokens: data?.tokens ?? [], apps: data?.apps ?? [] };
  },

  async createPersonalToken(input: { label: string; prefix: string; hash: string; scopes: McpScope[]; days: number }): Promise<string> {
    return rpc<string>("mcp_create_personal_token", {
      p_label: input.label, p_prefix: input.prefix, p_hash: input.hash, p_scopes: input.scopes, p_days: input.days,
    });
  },

  async revokePersonalToken(id: string): Promise<boolean> {
    return rpc<boolean>("mcp_revoke_personal_token", { p_id: id });
  },

  async revokeApp(grantId: string): Promise<boolean> {
    return rpc<boolean>("mcp_revoke_app", { p_grant_id: grantId });
  },

  async oauthClientInfo(clientId: string, redirectUri: string): Promise<OAuthClientInfo | null> {
    return rpc<OAuthClientInfo | null>("mcp_oauth_client_info", { p_client_id: clientId, p_redirect_uri: redirectUri });
  },

  async oauthIssueCode(input: { clientId: string; redirectUri: string; codeChallenge: string; scopes: McpScope[]; resource: string | null }): Promise<string> {
    return rpc<string>("mcp_oauth_issue_code", {
      p_client_id: input.clientId, p_redirect_uri: input.redirectUri, p_code_challenge: input.codeChallenge,
      p_scopes: input.scopes, p_resource: input.resource,
    });
  },
};

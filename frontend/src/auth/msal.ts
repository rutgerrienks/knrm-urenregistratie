import { PublicClientApplication } from "@azure/msal-browser";

import { api } from "../api/client";

export interface SsoConfig {
  enabled: boolean;
  tenant_id: string;
  client_id: string;
}

export function fetchSsoConfig(): Promise<SsoConfig> {
  return api.get<SsoConfig>("/api/auth/sso/config");
}

/** Start de Entra ID-popupflow (PKCE) en geeft het id_token terug. */
export async function acquireEntraIdToken(config: SsoConfig): Promise<string> {
  const pca = new PublicClientApplication({
    auth: {
      clientId: config.client_id,
      authority: `https://login.microsoftonline.com/${config.tenant_id}`,
      redirectUri: `${window.location.origin}/`,
    },
    cache: { cacheLocation: "sessionStorage" },
  });
  await pca.initialize();
  const result = await pca.loginPopup({
    scopes: ["openid", "profile", "email"],
    prompt: "select_account",
  });
  return result.idToken;
}

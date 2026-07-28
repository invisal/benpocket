export interface KubeApiConfig {
  server?: string;
  token?: string;
  caData?: string;
}

export class KubeClientService {
  /**
   * Direct Kubernetes API client service helper.
   * Can perform direct HTTP REST requests to Kubernetes API Server endpoint when configured.
   */
  public static async getResourcesDirect(
    configPath?: string,
    contextName?: string,
    resource?: string,
    namespace?: string
  ): Promise<{ items?: unknown[]; error?: string } | null> {
    // Suppress unused parameter linter warnings for skeleton implementation
    void configPath;
    void contextName;
    void resource;
    void namespace;

    // Currently returns null to signal routing to KubeCliService fallback
    // until full native REST transport is configured
    return null;
  }
}

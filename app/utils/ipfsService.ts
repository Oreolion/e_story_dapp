export interface IPFSUploadResult {
  hash: string;
  url: string;
}

export class IPFSService {
  private static instance: IPFSService;
  // Use your gateway or a public one as fallback
  private readonly gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

  static getInstance(): IPFSService {
    if (!IPFSService.instance) {
      IPFSService.instance = new IPFSService();
    }
    return IPFSService.instance;
  }

  /**
   * Build auth headers from token.
   * Token should be obtained from AuthProvider's getAccessToken() by the caller.
   */
  private buildAuthHeaders(accessToken?: string | null): Record<string, string> {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  /**
   * Uploads JSON metadata (for NFTs/Books) to IPFS via our API route.
   */
  async uploadMetadata(data: any, accessToken: string | null | undefined, publication: { visibility: "public" }): Promise<IPFSUploadResult> {
    try {
      if (publication?.visibility !== "public") throw new Error("Explicit public publication is required");
      const formData = new FormData();
      formData.append("visibility", "public");
      // Send as stringified JSON
      formData.append("metadata", JSON.stringify(data));

      const authHeaders = this.buildAuthHeaders(accessToken);
      const response = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: { ...authHeaders },
        body: formData,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to upload metadata");
      }

      return await response.json();
    } catch (error) {
      console.error("IPFS Metadata Upload Error:", error);
      throw error;
    }
  }

  /**
   * Uploads a physical file (Audio/Image) to IPFS via our API route.
   */
  async uploadFile(file: Blob, accessToken: string | null | undefined, publication: { visibility: "public" }): Promise<IPFSUploadResult> {
    try {
      if (publication?.visibility !== "public") throw new Error("Explicit public publication is required");
      const formData = new FormData();
      formData.append("visibility", "public");
      formData.append("file", file);

      const authHeaders = this.buildAuthHeaders(accessToken);
      const response = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: { ...authHeaders },
        body: formData,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to upload file");
      }

      return await response.json();
    } catch (error) {
      console.error("IPFS File Upload Error:", error);
      throw error;
    }
  }

  getGatewayUrl(hash: string): string {
    return `${this.gatewayUrl}${hash}`;
  }
}

export const ipfsService = IPFSService.getInstance();

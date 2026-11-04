import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ipfsService } from "../app/utils/ipfsService";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RecordPage from "../app/record/RecordPageClient";

// Create a test QueryClient with retries disabled for faster tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
};

// --- 1. MOCK DEPENDENCIES ---

// Mock the Browser API (getUserMedia) since JSDOM doesn't have a microphone
Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  writable: true,
});

// Mock MediaRecorder
global.MediaRecorder = class {
  state = "inactive";
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.onstop();
  }
  //   ondataavailable(e: any) {}
  onstop() {}
  //   constructor(stream: any) {}
} as any;

// Mock Supabase (Data Layer)
vi.mock("../app/utils/supabase/supabaseClient", () => ({
  supabaseClient: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({
        eq: () => ({
          single: vi.fn(),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: vi
          .fn()
          .mockResolvedValue({ data: { path: "test/path" }, error: null }),
        getPublicUrl: vi
          .fn()
          .mockReturnValue({
            data: { publicUrl: "https://mock-storage.com/audio.webm" },
          }),
      }),
    },
  },
}));

// Mock IPFS (Decentralized Storage)
vi.mock("../app/utils/ipfsService", () => ({
  ipfsService: {
    uploadMetadata: vi.fn().mockResolvedValue({ hash: "QmMockHash123" }),
  },
}));

// Mock Auth (Simulate User Logged In)
vi.mock("../components/AuthProvider", () => ({
  useAuth: () => ({
    profile: {
      id: "test-user-123",
      wallet_address: "0x123...abc",
      is_onboarded: true,
      auth_provider: "wallet",
    },
    isLoading: false,
    needsOnboarding: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    completeOnboarding: vi.fn(),
    refreshProfile: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("synthetic-record-token"),
  }),
}));

// Mock Web3 Provider (Simulate Wallet Connected)
vi.mock("../components/Provider", () => ({
  useApp: () => ({
    isConnected: true,
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

// Mock BackgroundContext (3D background provider)
vi.mock("../contexts/BackgroundContext", () => ({
  useBackground: () => ({
    config: { mode: "record" },
    mode: "record",
    setMode: vi.fn(),
    setAudioLevel: vi.fn(),
    setMousePosition: vi.fn(),
    setScrollProgress: vi.fn(),
    setEmotionalTone: vi.fn(),
    isEnabled: true,
    setIsEnabled: vi.fn(),
  }),
  useBackgroundMode: vi.fn(),
}));

// --- 2. TEST SUITE ---

describe("RecordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main recording interface", () => {
    renderWithProviders(<RecordPage />);

    // Check Title
    expect(screen.getByText(/Record Your/)).toBeInTheDocument();
    expect(screen.getByText("Story")).toBeInTheDocument();

    // Check "Audio Recording" section
    expect(screen.getByText("Audio Recording")).toBeInTheDocument();

    // Check "Entry Title" input exists
    expect(
      screen.getByPlaceholderText("Give your story a title...")
    ).toBeInTheDocument();
  });

  it("shows the microphone button", () => {
    renderWithProviders(<RecordPage />);
    // The button usually contains an SVG, but we can check for the text around it or role
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("handles text input for title and transcription", () => {
    renderWithProviders(<RecordPage />);

    const titleInput = screen.getByPlaceholderText(
      "Give your story a title..."
    );
    const transcriptionArea = screen.getByPlaceholderText(
      /What happened today/i
    );

    fireEvent.change(titleInput, { target: { value: "My Day" } });
    fireEvent.change(transcriptionArea, {
      target: { value: "This is a test entry." },
    });

    expect((titleInput as HTMLInputElement).value).toBe("My Day");
    expect((transcriptionArea as HTMLTextAreaElement).value).toBe(
      "This is a test entry."
    );
  });

  it("shows save button", () => {
    renderWithProviders(<RecordPage />);
    expect(screen.getByText("Save Privately")).toBeInTheDocument();
  });
  it.each([false, true])("saves the intended visibility and publishes only when public=%s", async isPublic => {
    sessionStorage.clear();
    const outbound = vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "/api/stories") throw new Error("Unexpected publication or inference destination");
      const body = JSON.parse(String(init?.body));
      expect(body.is_public).toBe(isPublic);
      expect(body.ipfs_hash).toBe(isPublic ? "QmMockHash123" : null);
      return new Response(JSON.stringify({ story: { id: "synthetic-story" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", outbound);
    try {
      renderWithProviders(<RecordPage />);
      fireEvent.change(screen.getByPlaceholderText("Give your story a title..."), { target: { value: "Synthetic private note" } });
      fireEvent.change(screen.getByPlaceholderText(/What happened today/i), { target: { value: "This synthetic entry contains no real private data." } });
      const visibility = screen.getByRole("switch", { name: "Publish story publicly" });
      expect(visibility).toHaveAttribute("aria-checked", "false");
      if (isPublic) fireEvent.click(visibility);
      fireEvent.click(screen.getByRole("button", { name: isPublic ? /Publish.*Save/ : "Save Privately" }));
      await waitFor(() => expect(outbound).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByPlaceholderText("Give your story a title...")).toHaveValue(""));
      expect(ipfsService.uploadMetadata).toHaveBeenCalledTimes(isPublic ? 1 : 0);
      if (isPublic) expect(ipfsService.uploadMetadata).toHaveBeenCalledWith(expect.objectContaining({ is_public: true }), "synthetic-record-token", { visibility: "public" });
    } finally { vi.unstubAllGlobals(); }
  });
});

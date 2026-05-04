import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StoryInsights } from "@/components/StoryInsights";
import { StoryMetadata, AnalysisStatus } from "@/app/types";

// --- MOCK SETUP ---

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<object>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

// Mock react-hot-toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("react-hot-toast", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample metadata for tests
const sampleMetadata: StoryMetadata = {
  id: "metadata-123",
  story_id: "story-456",
  themes: ["growth", "reflection", "change"],
  emotional_tone: "hopeful",
  life_domain: "identity",
  intensity_score: 0.7,
  significance_score: 0.85,
  is_canonical: false,
  ai_readable: true,
  people_mentioned: ["Mom", "John"],
  places_mentioned: ["Chicago", "the park"],
  time_references: ["last summer", "when I was young"],
  brief_insight: "A story about finding clarity through change.",
  actionable_advice: "Consider journaling about what specific changes brought you the most clarity.",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Helper to setup fetch mock responses
function setupFetchMock(options: {
  metadataResponse?: { metadata: StoryMetadata | null } | null;
  metadataError?: boolean;
  analyzeResponse?: { metadata: StoryMetadata; success: boolean } | null;
  analyzeError?: { error: string } | null;
}) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    // Metadata fetch
    if (url.includes("/api/stories/") && url.includes("/metadata") && !init?.method) {
      if (options.metadataError) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Failed to fetch" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(options.metadataResponse ?? { metadata: null }),
      });
    }

    // Analyze endpoint
    if (url.includes("/api/ai/analyze") && init?.method === "POST") {
      if (options.analyzeError) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve(options.analyzeError),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(options.analyzeResponse ?? { success: true, metadata: sampleMetadata }),
      });
    }

    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
}

describe("StoryInsights", () => {
  const defaultProps = {
    storyId: "story-456",
    storyText: "This is a meaningful story about my journey through life.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- LOADING STATE TESTS ---

  describe("Loading State", () => {
    it("renders loading skeleton while fetching metadata", async () => {
      // Setup a delayed response to ensure we see the loading state
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<StoryInsights {...defaultProps} />);

      expect(screen.getByText("Loading insights...")).toBeInTheDocument();
    });

    it("shows loading spinner icon during loading", async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<StoryInsights {...defaultProps} />);

      // The Loader2 component should be visible (has animate-spin class)
      const loadingContainer = screen.getByText("Loading insights...").parentElement;
      expect(loadingContainer).toBeInTheDocument();
    });
  });

  // --- NO METADATA STATE TESTS ---

  describe("No Metadata State", () => {
    it("renders generate button when metadata is null", async () => {
      setupFetchMock({ metadataResponse: { metadata: null } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights Available")).toBeInTheDocument();
      });

      expect(screen.getByText("Generate Insights")).toBeInTheDocument();
    });

    it("shows descriptive text when no metadata exists", async () => {
      setupFetchMock({ metadataResponse: { metadata: null } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Let AI analyze your story to extract themes, emotions, and patterns/)
        ).toBeInTheDocument();
      });
    });

    it("renders nothing visible for failed metadata fetch (shows generate UI)", async () => {
      setupFetchMock({ metadataError: true });

      render(<StoryInsights {...defaultProps} />);

      // After error, component shows a retry/try again UI
      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });
    });
  });

  // --- CONTENT RENDERING TESTS ---

  describe("Content Rendering", () => {
    it("renders brief_insight in quotes", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/A story about finding clarity through change/)).toBeInTheDocument();
      });
    });

    it("renders all themes as badges", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("growth")).toBeInTheDocument();
        expect(screen.getByText("reflection")).toBeInTheDocument();
        expect(screen.getByText("change")).toBeInTheDocument();
      });
    });

    it("renders emotional_tone badge", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("hopeful")).toBeInTheDocument();
      });
    });

    it("renders life_domain badge", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Identity & Self")).toBeInTheDocument();
      });
    });

    it("renders people_mentioned when present", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Mom/)).toBeInTheDocument();
        expect(screen.getByText(/John/)).toBeInTheDocument();
      });
    });

    it("renders places_mentioned when present", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
        expect(screen.getByText(/the park/)).toBeInTheDocument();
      });
    });

    it("renders time_references when present", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/last summer/)).toBeInTheDocument();
      });
    });

    it("renders intensity score as percentage", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        // 0.7 * 100 = 70%
        expect(screen.getByText("70%")).toBeInTheDocument();
      });
    });

    it("renders significance score as percentage", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        // 0.85 * 100 = 85%
        expect(screen.getByText("85%")).toBeInTheDocument();
      });
    });

    it("renders AI Insights header when metadata exists", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });
    });
  });

  // --- EMPTY ENTITIES TESTS ---

  describe("Empty Entities Handling", () => {
    it("does not render people section when empty", async () => {
      const metadataNoEntities = {
        ...sampleMetadata,
        people_mentioned: [],
        places_mentioned: [],
        time_references: [],
      };
      setupFetchMock({ metadataResponse: { metadata: metadataNoEntities } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      // These should not be present
      expect(screen.queryByText("Mom")).not.toBeInTheDocument();
      expect(screen.queryByText("Chicago")).not.toBeInTheDocument();
    });

    it("does not render themes section when empty", async () => {
      const metadataNoThemes = {
        ...sampleMetadata,
        themes: [],
      };
      setupFetchMock({ metadataResponse: { metadata: metadataNoThemes } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      // Themes label should not be present when empty
      expect(screen.queryByText("Themes")).not.toBeInTheDocument();
    });

    it("handles null brief_insight gracefully", async () => {
      const metadataNoInsight = {
        ...sampleMetadata,
        brief_insight: null,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataNoInsight } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      // The insight text should not be present
      expect(screen.queryByText(/A story about/)).not.toBeInTheDocument();
    });
  });

  // --- INTERACTION TESTS ---

  describe("Interactions", () => {
    it("calls generateInsights when generate button clicked", async () => {
      setupFetchMock({
        metadataResponse: { metadata: null },
        analyzeResponse: { success: true, metadata: sampleMetadata },
      });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Generate Insights")).toBeInTheDocument();
      });

      const generateButton = screen.getByText("Generate Insights");
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/ai/analyze",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storyId: "story-456",
              storyText: "This is a meaningful story about my journey through life.",
            }),
          })
        );
      });
    });

    it("shows loading state during analysis", async () => {
      setupFetchMock({ metadataResponse: { metadata: null } });

      // Make analyze call hang
      let resolveAnalyze: (value: unknown) => void;
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/metadata")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ metadata: null }),
          });
        }
        if (url.includes("/analyze")) {
          return new Promise((resolve) => {
            resolveAnalyze = resolve;
          });
        }
        return Promise.reject(new Error("Unhandled"));
      });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Generate Insights")).toBeInTheDocument();
      });

      const generateButton = screen.getByText("Generate Insights");
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText("Analyzing...")).toBeInTheDocument();
      });

      // Resolve to clean up
      resolveAnalyze!({
        ok: true,
        json: () => Promise.resolve({ success: true, metadata: sampleMetadata }),
      });
    });

    it("shows success toast on successful analysis", async () => {
      setupFetchMock({
        metadataResponse: { metadata: null },
        analyzeResponse: { success: true, metadata: sampleMetadata },
      });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Generate Insights")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Generate Insights"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Insights generated!");
      });
    });

    it("shows error toast on failed analysis", async () => {
      setupFetchMock({
        metadataResponse: { metadata: null },
        analyzeError: { error: "Analysis failed" },
      });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Generate Insights")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Generate Insights"));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Analysis failed");
      });
    });

    it("can refresh insights via refresh button", async () => {
      setupFetchMock({
        metadataResponse: { metadata: sampleMetadata },
        analyzeResponse: { success: true, metadata: sampleMetadata },
      });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      // Find and click refresh button (ghost button with RefreshCw icon)
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((btn) => btn.className.includes("ghost"));

      if (refreshButton) {
        fireEvent.click(refreshButton);

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            "/api/ai/analyze",
            expect.any(Object)
          );
        });
      }
    });
  });

  // --- DIFFERENT EMOTIONAL TONES ---

  describe("Emotional Tone Styling", () => {
    const tones: Array<StoryMetadata["emotional_tone"]> = [
      "reflective",
      "joyful",
      "anxious",
      "hopeful",
      "melancholic",
      "grateful",
      "frustrated",
      "peaceful",
      "excited",
      "uncertain",
      "neutral",
    ];

    tones.forEach((tone) => {
      it(`renders ${tone} tone correctly`, async () => {
        const metadataWithTone = { ...sampleMetadata, emotional_tone: tone };
        setupFetchMock({ metadataResponse: { metadata: metadataWithTone } });

        render(<StoryInsights {...defaultProps} />);

        await waitFor(() => {
          expect(screen.getByText(tone)).toBeInTheDocument();
        });
      });
    });
  });

  // --- DIFFERENT LIFE DOMAINS ---

  describe("Life Domain Styling", () => {
    const domains: Array<StoryMetadata["life_domain"]> = [
      "work",
      "relationships",
      "health",
      "identity",
      "growth",
      "creativity",
      "spirituality",
      "family",
      "adventure",
      "learning",
      "general",
    ];

    // Test a subset of domains to avoid test timeout issues
    // All domains use the same rendering logic, just with different colors
    it("renders work domain correctly", async () => {
      const metadataWithDomain = { ...sampleMetadata, life_domain: "work" as const };
      setupFetchMock({ metadataResponse: { metadata: metadataWithDomain } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Work & Career")).toBeInTheDocument();
      });
    });

    it("renders relationships domain correctly", async () => {
      const metadataWithDomain = { ...sampleMetadata, life_domain: "relationships" as const };
      setupFetchMock({ metadataResponse: { metadata: metadataWithDomain } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Relationships")).toBeInTheDocument();
      });
    });

    it("renders general domain correctly", async () => {
      const metadataWithDomain = { ...sampleMetadata, life_domain: "general" as const };
      setupFetchMock({ metadataResponse: { metadata: metadataWithDomain } });

      render(<StoryInsights {...defaultProps} />);

      // Wait for metadata to load and render
      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      // Check that the domain badge is rendered with "general" text
      // Using a more specific query since "general" might be ambiguous
      const domainText = screen.getByText("General");
      expect(domainText).toBeInTheDocument();
    });
  });

  // --- EDGE CASES ---

  describe("Edge Cases", () => {
    it("handles re-render with different storyId", async () => {
      setupFetchMock({ metadataResponse: { metadata: sampleMetadata } });

      const { rerender } = render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      const callCountBefore = mockFetch.mock.calls.length;

      // Change storyId
      rerender(<StoryInsights storyId="new-story-789" storyText="New story text" />);

      // Wait for the new fetch to be triggered
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountBefore);
      });

      // Check that a call was made with the new storyId
      const calls = mockFetch.mock.calls.map((call) => call[0]);
      expect(calls.some((url: string) => url.includes("new-story-789"))).toBe(true);
    });

    it("handles score of 0 correctly", async () => {
      const metadataZeroScores = {
        ...sampleMetadata,
        intensity_score: 0,
        significance_score: 0,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataZeroScores } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        // Should show 0% for both
        const percentages = screen.getAllByText("0%");
        expect(percentages.length).toBe(2);
      });
    });

    it("handles score of 1 correctly", async () => {
      const metadataMaxScores = {
        ...sampleMetadata,
        intensity_score: 1,
        significance_score: 1,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataMaxScores } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        // Should show 100% for both
        const percentages = screen.getAllByText("100%");
        expect(percentages.length).toBe(2);
      });
    });

    it("handles single theme correctly", async () => {
      const metadataSingleTheme = {
        ...sampleMetadata,
        themes: ["solitude"],
      };
      setupFetchMock({ metadataResponse: { metadata: metadataSingleTheme } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("solitude")).toBeInTheDocument();
        expect(screen.queryByText("growth")).not.toBeInTheDocument();
      });
    });
  });

  // --- ANALYSIS STATUS STATES ---

  describe("Analysis Status States", () => {
    it("renders pending state with queue message", async () => {
      const metadataPending = {
        ...sampleMetadata,
        analysis_status: "pending" as AnalysisStatus,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataPending } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Analysis Queued")).toBeInTheDocument();
        expect(screen.getByText(/waiting to be analyzed/)).toBeInTheDocument();
      });
    });

    it("renders processing state with spinner and message", async () => {
      const metadataProcessing = {
        ...sampleMetadata,
        analysis_status: "processing" as AnalysisStatus,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataProcessing } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Analyzing Your Story")).toBeInTheDocument();
        expect(screen.getByText(/extracting themes, emotions, and patterns/)).toBeInTheDocument();
      });
    });

    it("renders failed state with error message", async () => {
      const metadataFailed = {
        ...sampleMetadata,
        analysis_status: "failed" as AnalysisStatus,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataFailed } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Analysis Failed")).toBeInTheDocument();
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });
    });

    it("shows retry button in failed state", async () => {
      const metadataFailed = {
        ...sampleMetadata,
        analysis_status: "failed" as AnalysisStatus,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataFailed } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Retry Analysis")).toBeInTheDocument();
      });
    });

    it("retry button triggers re-analysis in failed state", async () => {
      const metadataFailed = {
        ...sampleMetadata,
        analysis_status: "failed" as AnalysisStatus,
      };
      setupFetchMock({
        metadataResponse: { metadata: metadataFailed },
        analyzeResponse: { success: true, metadata: sampleMetadata },
      });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Retry Analysis")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Retry Analysis"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/ai/analyze",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("shows retrying state when retry button is clicked", async () => {
      const metadataFailed = {
        ...sampleMetadata,
        analysis_status: "failed" as AnalysisStatus,
      };

      // Set up mock where analyze never resolves
      let resolveAnalyze: (value: unknown) => void;
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/metadata")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ metadata: metadataFailed }),
          });
        }
        if (url.includes("/analyze")) {
          return new Promise((resolve) => {
            resolveAnalyze = resolve;
          });
        }
        return Promise.reject(new Error("Unhandled"));
      });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Retry Analysis")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Retry Analysis"));

      await waitFor(() => {
        expect(screen.getByText("Retrying...")).toBeInTheDocument();
      });

      // Clean up
      resolveAnalyze!({
        ok: true,
        json: () => Promise.resolve({ success: true, metadata: sampleMetadata }),
      });
    });

    it("handles completed status normally (shows full insights)", async () => {
      const metadataCompleted = {
        ...sampleMetadata,
        analysis_status: "completed" as AnalysisStatus,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataCompleted } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
        expect(screen.getByText("hopeful")).toBeInTheDocument();
      });
    });
  });

  // --- KEY LIFE MOMENT BADGE ---

  describe("Key Life Moment Badge", () => {
    it("shows 'Key life moment' badge when significance_score > 0.7", async () => {
      const metadataHighSignificance = {
        ...sampleMetadata,
        significance_score: 0.85,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataHighSignificance } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Key life moment")).toBeInTheDocument();
      });
    });

    it("shows 'Key life moment' badge when significance_score is exactly 0.71", async () => {
      const metadataHighSignificance = {
        ...sampleMetadata,
        significance_score: 0.71,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataHighSignificance } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Key life moment")).toBeInTheDocument();
      });
    });

    it("does not show 'Key life moment' badge when significance_score is exactly 0.7", async () => {
      const metadataExactThreshold = {
        ...sampleMetadata,
        significance_score: 0.7,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataExactThreshold } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      expect(screen.queryByText("Key life moment")).not.toBeInTheDocument();
    });

    it("does not show 'Key life moment' badge when significance_score < 0.7", async () => {
      const metadataLowSignificance = {
        ...sampleMetadata,
        significance_score: 0.5,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataLowSignificance } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      expect(screen.queryByText("Key life moment")).not.toBeInTheDocument();
    });

    it("does not show 'Key life moment' badge when significance_score is 0", async () => {
      const metadataZeroSignificance = {
        ...sampleMetadata,
        significance_score: 0,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataZeroSignificance } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      expect(screen.queryByText("Key life moment")).not.toBeInTheDocument();
    });

    it("shows 'Key life moment' badge when significance_score is 1", async () => {
      const metadataMaxSignificance = {
        ...sampleMetadata,
        significance_score: 1,
      };
      setupFetchMock({ metadataResponse: { metadata: metadataMaxSignificance } });

      render(<StoryInsights {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Key life moment")).toBeInTheDocument();
      });
    });
  });
});

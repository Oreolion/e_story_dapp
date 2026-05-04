import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- MOCK SETUP ---

// Mock environment variable
const originalEnv = process.env;

// Mock auth - use vi.hoisted to avoid hoisting issues
const { MOCK_USER_ID } = vi.hoisted(() => ({
  MOCK_USER_ID: "test-user-123",
}));

vi.mock("@/lib/auth", () => ({
  validateAuthOrReject: vi.fn().mockResolvedValue(MOCK_USER_ID),
  isAuthError: vi.fn().mockReturnValue(false),
}));

// Mock Supabase admin client
const mockSupabaseFrom = vi.fn();
const mockSupabaseUpsert = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();
// For ownership check
const mockOwnershipSelect = vi.fn();
const mockOwnershipEq = vi.fn();
const mockOwnershipSingle = vi.fn();
// For users table (subscription check)
const mockUserSelect = vi.fn();
const mockUserEq = vi.fn();
const mockUserSingle = vi.fn();

vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

// Mock Google Generative AI - use vi.hoisted to avoid hoisting issues
const { mockGenerateContent, MockGoogleGenerativeAI } = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();

  class MockGoogleGenerativeAI {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_apiKey: string) {}
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      };
    }
  }

  return { mockGenerateContent, MockGoogleGenerativeAI };
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: MockGoogleGenerativeAI,
}));

// Helper to create mock NextRequest
function createMockRequest(body: object): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as NextRequest;
}

// Helper to setup Supabase mock chain
function setupSupabaseMock(options: {
  upsertData?: object | null;
  upsertError?: { code?: string; message?: string } | null;
  ownerAuthorId?: string; // defaults to MOCK_USER_ID (passes ownership check)
  isPaidUser?: boolean; // defaults to true (skips monthly limit check)
}) {
  // Ownership check: from("stories").select("author_id").eq("id", storyId).single()
  mockOwnershipSingle.mockResolvedValue({
    data: { author_id: options.ownerAuthorId ?? MOCK_USER_ID },
    error: null,
  });
  mockOwnershipEq.mockReturnValue({ single: mockOwnershipSingle });
  mockOwnershipSelect.mockReturnValue({ eq: mockOwnershipEq });

  // Users table: subscription check — default to paid user to skip monthly limit logic
  const isPaid = options.isPaidUser ?? true;
  mockUserSingle.mockResolvedValue({
    data: isPaid
      ? { subscription_plan: "storyteller", subscription_expires_at: "2099-12-31T00:00:00Z" }
      : { subscription_plan: "free", subscription_expires_at: null },
    error: null,
  });
  mockUserEq.mockReturnValue({ single: mockUserSingle });
  mockUserSelect.mockReturnValue({ eq: mockUserEq });

  // Upsert chain: from("story_metadata").upsert(...).select().single()
  mockSupabaseSingle.mockResolvedValue({
    data: options.upsertData ?? null,
    error: options.upsertError ?? null,
  });

  mockSupabaseSelect.mockReturnValue({
    single: mockSupabaseSingle,
  });

  mockSupabaseUpsert.mockReturnValue({
    select: mockSupabaseSelect,
  });

  // Route calls from() for different tables
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "stories") {
      return { select: mockOwnershipSelect };
    }
    if (table === "users") {
      return { select: mockUserSelect };
    }
    // story_metadata
    return { upsert: mockSupabaseUpsert };
  });
}

// Helper to setup Gemini mock response
function setupGeminiMock(responseText: string) {
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => responseText,
    },
  });
}

// Valid mock metadata response from Gemini
const validMetadataResponse = JSON.stringify({
  themes: ["growth", "reflection", "change"],
  emotional_tone: "hopeful",
  life_domain: "identity",
  intensity_score: 0.7,
  significance_score: 0.8,
  people_mentioned: ["Mom", "John"],
  places_mentioned: ["Chicago", "the park"],
  time_references: ["last summer", "when I was young"],
  brief_insight: "A story about finding clarity through change.",
});

// Valid story text that meets minimum length requirement (50+ characters)
const validStoryText = "This is a meaningful story about my journey through life and all the experiences I've had.";
const shortStoryText = "Hi.";

// Import the route handler after mocks are set up
import { POST } from "@/app/api/ai/analyze/route";

describe("POST /api/ai/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables
    process.env = {
      ...originalEnv,
      GOOGLE_GENERATIVE_AI_API_KEY: "test-api-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // --- INPUT VALIDATION TESTS ---

  describe("Input Validation", () => {
    it("returns 400 when storyId is missing", async () => {
      const req = createMockRequest({ storyText: "Some story text" });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing required fields");
    });

    it("returns 400 when storyText is missing", async () => {
      const req = createMockRequest({ storyId: "test-uuid-123" });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing required fields");
    });

    it("returns 400 when both storyId and storyText are missing", async () => {
      const req = createMockRequest({});
      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing required fields");
    });

    it("returns 500 when API key is not configured", async () => {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: "Test story content",
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("API Key missing");
    });
  });

  // --- SUCCESS CASES ---

  describe("Success Cases", () => {
    it("returns 200 with valid metadata for normal story", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({
        upsertData: {
          id: "metadata-id",
          story_id: "test-uuid",
          themes: ["growth", "reflection", "change"],
          emotional_tone: "hopeful",
          life_domain: "identity",
        },
      });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: "This is a meaningful story about my journey through life.",
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.metadata).toBeDefined();
      expect(data.insight).toBe("A story about finding clarity through change.");
    });

    it("handles stories with special characters", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: "This is a story with special chars: @#$%^&*(){}[]|\\<>?/~`'\" and more text to meet minimum length requirements.",
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("handles stories with non-English content", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: "Une histoire en français avec des caractères spéciaux: é, è, ê, ë, à, â, ô, ù, ç. C'est une belle journée.",
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("handles stories with emojis", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: "Today was an amazing day! 🎉 I felt so happy 😊 and grateful 🙏 for all the wonderful moments we shared together.",
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  // --- GEMINI INTEGRATION TESTS ---

  describe("Gemini Integration", () => {
    it("parses valid Gemini JSON response", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("handles Gemini response with markdown code blocks", async () => {
      const wrappedResponse = "```json\n" + validMetadataResponse + "\n```";
      setupGeminiMock(wrappedResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("uses fallback value for invalid emotional_tone", async () => {
      const invalidToneResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        emotional_tone: "invalid_tone",
      });
      setupGeminiMock(invalidToneResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      // Check that upsert was called with 'neutral' fallback
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          emotional_tone: "neutral",
        }),
        expect.any(Object)
      );
    });

    it("uses fallback value for invalid life_domain", async () => {
      const invalidDomainResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        life_domain: "invalid_domain",
      });
      setupGeminiMock(invalidDomainResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          life_domain: "general",
        }),
        expect.any(Object)
      );
    });

    it("clamps intensity_score to 0-1 range (above 1)", async () => {
      const outOfRangeResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        intensity_score: 1.5,
      });
      setupGeminiMock(outOfRangeResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          intensity_score: 1,
        }),
        expect.any(Object)
      );
    });

    it("clamps significance_score to 0-1 range (below 0)", async () => {
      const outOfRangeResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        significance_score: -0.5,
      });
      setupGeminiMock(outOfRangeResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          significance_score: 0,
        }),
        expect.any(Object)
      );
    });

    it("uses default 0.5 for non-numeric scores", async () => {
      const nonNumericResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        intensity_score: "high",
        significance_score: "important",
      });
      setupGeminiMock(nonNumericResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          intensity_score: 0.5,
          significance_score: 0.5,
        }),
        expect.any(Object)
      );
    });

    it("converts non-array themes to empty array", async () => {
      const invalidThemesResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        themes: "just a string",
      });
      setupGeminiMock(invalidThemesResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          themes: [],
        }),
        expect.any(Object)
      );
    });

    it("limits themes to maximum 5", async () => {
      const manyThemesResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        themes: ["one", "two", "three", "four", "five", "six", "seven"],
      });
      setupGeminiMock(manyThemesResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          themes: expect.arrayContaining(["one", "two", "three", "four", "five"]),
        }),
        expect.any(Object)
      );
      // Verify only 5 themes
      const callArgs = mockSupabaseUpsert.mock.calls[0][0];
      expect(callArgs.themes).toHaveLength(5);
    });

    it("truncates brief_insight to 500 characters", async () => {
      const longInsight = "A".repeat(600);
      const longInsightResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        brief_insight: longInsight,
      });
      setupGeminiMock(longInsightResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const callArgs = mockSupabaseUpsert.mock.calls[0][0];
      expect(callArgs.brief_insight).toHaveLength(500);
    });
  });

  // --- DATABASE OPERATION TESTS ---

  describe("Database Operations", () => {
    it("creates new metadata record via upsert", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({
        upsertData: {
          id: "new-metadata-id",
          story_id: "test-uuid",
        },
      });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseFrom).toHaveBeenCalledWith("story_metadata");
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          story_id: "test-uuid",
        }),
        expect.objectContaining({
          onConflict: "story_id",
        })
      );
    });

    it("updates existing metadata record via upsert", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({
        upsertData: {
          id: "existing-metadata-id",
          story_id: "test-uuid",
        },
      });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: "Updated story content for re-analysis with more details about my journey and experiences.",
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          story_id: "test-uuid",
          updated_at: expect.any(String),
        }),
        expect.objectContaining({
          onConflict: "story_id",
        })
      );
    });

    it("includes updated_at timestamp", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const beforeTime = new Date().toISOString();
      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      await POST(req);
      const afterTime = new Date().toISOString();

      const callArgs = mockSupabaseUpsert.mock.calls[0][0];
      expect(callArgs.updated_at).toBeDefined();
      expect(callArgs.updated_at >= beforeTime).toBe(true);
      expect(callArgs.updated_at <= afterTime).toBe(true);
    });
  });

  // --- ERROR HANDLING TESTS ---

  describe("Error Handling", () => {
    it("handles Gemini API error", async () => {
      mockGenerateContent.mockRejectedValue(new Error("Gemini API error"));

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to analyze story");
    });

    it("handles malformed JSON from Gemini", async () => {
      setupGeminiMock("This is not valid JSON at all { broken");

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("invalid JSON");
    });

    it("handles database write failure", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({
        upsertError: { message: "Database connection failed" },
      });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Failed to save metadata");
    });

    it("handles missing story_metadata table", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({
        upsertError: { code: "42P01", message: "relation does not exist" },
      });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("story_metadata");
      expect(data.migration_required).toBe(true);
    });

    it("handles empty Gemini response", async () => {
      setupGeminiMock("");

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("invalid JSON");
    });

    it("handles JSON.parse throwing on request body", async () => {
      const req = {
        json: () => Promise.reject(new Error("Invalid JSON body")),
      } as NextRequest;

      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to analyze story");
    });
  });

  // --- EDGE CASES ---

  describe("Edge Cases", () => {
    it("returns 400 when storyText is too short", async () => {
      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: shortStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("at least");
    });

    it("handles null values in arrays from Gemini", async () => {
      const nullArraysResponse = JSON.stringify({
        themes: [null, "growth", null],
        emotional_tone: "hopeful",
        life_domain: "identity",
        intensity_score: 0.5,
        significance_score: 0.5,
        people_mentioned: [null],
        places_mentioned: [],
        time_references: ["yesterday", null],
        brief_insight: "A brief insight.",
      });
      setupGeminiMock(nullArraysResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      // The String(t) conversion should handle nulls
      const callArgs = mockSupabaseUpsert.mock.calls[0][0];
      expect(callArgs.themes).toContain("null");
      expect(callArgs.themes).toContain("growth");
    });

    it("handles numeric values instead of strings in arrays", async () => {
      const numericArraysResponse = JSON.stringify({
        themes: [123, "growth"],
        emotional_tone: "hopeful",
        life_domain: "identity",
        intensity_score: 0.5,
        significance_score: 0.5,
        people_mentioned: [],
        places_mentioned: [456],
        time_references: [],
        brief_insight: "A brief insight.",
      });
      setupGeminiMock(numericArraysResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const callArgs = mockSupabaseUpsert.mock.calls[0][0];
      expect(callArgs.themes).toContain("123");
      expect(callArgs.places_mentioned).toContain("456");
    });

    it("handles missing optional fields in Gemini response", async () => {
      const minimalResponse = JSON.stringify({
        themes: ["minimal"],
        emotional_tone: "neutral",
        life_domain: "general",
      });
      setupGeminiMock(minimalResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const callArgs = mockSupabaseUpsert.mock.calls[0][0];
      expect(callArgs.intensity_score).toBe(0.5);
      expect(callArgs.significance_score).toBe(0.5);
      expect(callArgs.people_mentioned).toEqual([]);
      expect(callArgs.places_mentioned).toEqual([]);
      expect(callArgs.time_references).toEqual([]);
      expect(callArgs.brief_insight).toBeNull();
    });

    it("converts themes to lowercase", async () => {
      const mixedCaseResponse = JSON.stringify({
        ...JSON.parse(validMetadataResponse),
        themes: ["GROWTH", "Reflection", "ChAnGe"],
      });
      setupGeminiMock(mixedCaseResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const callArgs = mockSupabaseUpsert.mock.calls[0][0];
      expect(callArgs.themes).toEqual(["growth", "reflection", "change"]);
    });

    it("truncates content over 10000 characters", async () => {
      setupGeminiMock(validMetadataResponse);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const longText = "a".repeat(15000);
      const req = createMockRequest({
        storyId: "test-uuid",
        storyText: longText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      // Check that Gemini was called with truncated text
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.length).toBeLessThan(15000);
      expect(callArgs).toContain("[truncated]");
    });
  });

  // --- NEW EDGE CASE HARDENING TESTS ---

  describe("Edge Case Hardening", () => {
    it("returns 409 when analysis is already in progress for same storyId", async () => {
      // First request - will be slow due to retry
      mockGenerateContent.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          response: { text: () => validMetadataResponse }
        }), 100))
      );
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "same-id" } });

      const req1 = createMockRequest({
        storyId: "same-id",
        storyText: validStoryText,
      });
      const req2 = createMockRequest({
        storyId: "same-id",
        storyText: validStoryText,
      });

      // Start first request but don't await
      const promise1 = POST(req1);

      // Small delay to ensure first request starts
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second request should be rejected
      const response2 = await POST(req2);
      expect(response2.status).toBe(409);
      const data = await response2.json();
      expect(data.error).toContain("already in progress");

      // Clean up first request
      await promise1;
    });

    it("handles retry on Gemini API failure", async () => {
      let callCount = 0;
      mockGenerateContent.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("Temporary Gemini error"));
        }
        return Promise.resolve({
          response: { text: () => validMetadataResponse }
        });
      });
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid-retry",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(callCount).toBe(3); // Should have retried
    });

    it("fails after max retries", async () => {
      mockGenerateContent.mockRejectedValue(new Error("Persistent Gemini error"));

      const req = createMockRequest({
        storyId: "test-uuid-fail",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to analyze story");
    });

    it("handles JSON with trailing commas from Gemini", async () => {
      const jsonWithTrailingComma = `{
        "themes": ["growth", "reflection",],
        "emotional_tone": "hopeful",
        "life_domain": "identity",
        "intensity_score": 0.7,
        "significance_score": 0.8,
        "people_mentioned": [],
        "places_mentioned": [],
        "time_references": [],
        "brief_insight": "A story about growth.",
      }`;
      setupGeminiMock(jsonWithTrailingComma);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid-comma",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
    });

    it("extracts JSON from text with surrounding content", async () => {
      const responseWithSurroundingText = `Here's the analysis:

      {"themes": ["growth"], "emotional_tone": "hopeful", "life_domain": "identity", "intensity_score": 0.7, "significance_score": 0.8, "people_mentioned": [], "places_mentioned": [], "time_references": [], "brief_insight": "A story."}

      Hope this helps!`;
      setupGeminiMock(responseWithSurroundingText);
      setupSupabaseMock({ upsertData: { id: "metadata-id", story_id: "test-uuid" } });

      const req = createMockRequest({
        storyId: "test-uuid-extract",
        storyText: validStoryText,
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });
});

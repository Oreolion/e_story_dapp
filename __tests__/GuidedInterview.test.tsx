import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GuidedInterview } from "@/components/story/GuidedInterview";
import { STARTER_QUESTION } from "@/lib/story/interview";
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ getAccessToken: async () => "synthetic-token" }),
}));
beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());
describe("author-controlled guided interviews", () => {
  it("stops a pending microphone permission from starting capture after leaving the mode", async () => {
    const stop = vi.fn();
    let permit!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          permit = resolve;
        }),
    );
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("MediaRecorder", class {});
    vi.stubGlobal("fetch", vi.fn());
    const props = { ownerId: "owner-a", active: true, onAddToStory: vi.fn() };
    const view = render(<GuidedInterview {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Record an answer" }));
    view.rerender(<GuidedInterview {...props} active={false} />);
    view.rerender(<GuidedInterview {...props} />);
    permit({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
  });
  it("transcribes an explicit answer recording and closes the microphone", async () => {
    const stop = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [{ stop }] }),
      },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        state = "inactive";
        mimeType = "audio/webm";
        onstop: (() => void) | null = null;
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["synthetic-audio"]) });
          this.onstop?.();
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ text: "A recorded answer." })),
      ),
    );
    const view = render(
      <GuidedInterview ownerId="owner-a" active onAddToStory={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record an answer" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Stop answer recording" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Your answer")).toHaveValue(
        "A recorded answer.",
      ),
    );
    expect(stop).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/ai/transcribe",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    view.unmount();
  });
  it("lets the author finish manually without inference, and prevents duplicate additions", () => {
    const add = vi.fn(),
      outbound = vi.fn();
    vi.stubGlobal("fetch", outbound);
    render(<GuidedInterview ownerId="owner-a" active onAddToStory={add} />);
    expect(screen.getByText(/Starter question/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "A journey home." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add answers to story" }),
    );
    expect(add).toHaveBeenCalledWith(`${STARTER_QUESTION}\nA journey home.`);
    expect(
      screen.getByRole("button", { name: "Added to story below" }),
    ).toBeDisabled();
    expect(outbound).not.toHaveBeenCalled();
  });
  it("preserves answers when AI is on hold, and retries the same context", async () => {
    const outbound = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "AI_PROVIDER_SETUP_REQUIRED" }), {
        status: 503,
      }),
    );
    // A fresh response is needed for each fetch body.
    outbound.mockImplementation(
      async () =>
        new Response(JSON.stringify({ code: "AI_PROVIDER_SETUP_REQUIRED" }), {
          status: 503,
        }),
    );
    vi.stubGlobal("fetch", outbound);
    const add = vi.fn();
    render(<GuidedInterview ownerId="owner-a" active onAddToStory={add} />);
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "A journey home." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next AI question" }));
    await screen.findByRole("alert");
    expect(screen.getByText("A journey home.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry next question" }),
    );
    await waitFor(() => expect(outbound).toHaveBeenCalledTimes(2));
    expect(outbound.mock.calls[0][1].body).toBe(outbound.mock.calls[1][1].body);
    expect(outbound.mock.calls[0][1].headers["x-profile-owner-id"]).toBe(
      "owner-a",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add answers to story" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add answers to story" }),
    );
    expect(add).toHaveBeenCalledTimes(1);
  });
  it("retains typed answers when switching modes and scopes storage to the owner", () => {
    const props = { ownerId: "owner-a", active: true, onAddToStory: vi.fn() };
    const view = render(<GuidedInterview {...props} />);
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "My private draft" },
    });
    view.rerender(<GuidedInterview {...props} active={false} />);
    view.rerender(<GuidedInterview {...props} />);
    expect(screen.getByLabelText("Your answer")).toHaveValue(
      "My private draft",
    );
    view.unmount();
    render(<GuidedInterview {...props} ownerId="owner-b" />);
    expect(screen.getByLabelText("Your answer")).toHaveValue("");
    expect(sessionStorage.getItem("estories_interview_v1:owner-a")).toContain(
      "My private draft",
    );
  });
  it("aborts in-flight questions on mode change without sending another request", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) => {
        signal = options.signal;
        return new Promise((_resolve, reject) =>
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
      }),
    );
    const props = { ownerId: "owner-a", active: true, onAddToStory: vi.fn() };
    const view = render(<GuidedInterview {...props} />);
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "Kept answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next AI question" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    view.rerender(<GuidedInterview {...props} active={false} />);
    expect(signal?.aborted).toBe(true);
  });
});

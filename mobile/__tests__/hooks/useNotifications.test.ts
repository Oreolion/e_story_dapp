import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), remove: vi.fn(), post: vi.fn(),
  permissions: vi.fn(), requestPermissions: vi.fn(), token: vi.fn(), channel: vi.fn(),
  owner: "user-1" as string | null,
}));
vi.mock("../../lib/api", () => ({ apiGet: mocks.get, apiPut: mocks.put, apiDelete: mocks.remove, apiPost: mocks.post }));
vi.mock("../../stores/authStore", () => ({ useAuthStore: () => ({ isAuthenticated: !!mocks.owner, user: mocks.owner ? { id: mocks.owner } : null }) }));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(), AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: mocks.channel,
  getPermissionsAsync: mocks.permissions,
  requestPermissionsAsync: mocks.requestPermissions,
  getExpoPushTokenAsync: mocks.token,
}));

import { registerForPushNotifications, useNotifications } from "../../hooks/useNotifications";

const row = (id: string, read = false) => ({
  id, user_id: "user-1", type: "like", title: "Story liked", message: "Someone liked your story",
  read, created_at: "2026-10-29T00:00:00Z",
});
const response = (data: unknown) => ({ ok: true, status: 200, data });

async function loadedHook() {
  const hook = renderHook(() => useNotifications());
  await waitFor(() => expect(hook.result.current.notifications).toHaveLength(2));
  return hook;
}

describe("notification API contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.owner = "user-1";
    Platform.OS = "ios";
    mocks.get.mockImplementation(async (url: string) => response(url.includes("count=true")
      ? { success: true, unreadCount: 7 }
      : { success: true, data: [row("unread"), row("read", true)], pagination: { hasMore: true } }));
    mocks.put.mockResolvedValue(response({ success: true }));
    mocks.remove.mockResolvedValue(response({ success: true }));
    mocks.channel.mockResolvedValue(undefined);
  });
  afterEach(() => { cleanup(); Platform.OS = "ios"; });

  it("maps the server read flag and uses the global unread count instead of counting a page", async () => {
    const { result } = await loadedHook();
    expect(result.current.notifications.map(n => n.is_read)).toEqual([false, true]);
    expect(result.current.unreadCount).toBe(7);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mocks.get).toHaveBeenCalledWith("/api/notifications?count=true");
  });

  it("reads pagination and appends new rows without duplicating overlapping records", async () => {
    const { result } = await loadedHook();
    mocks.get.mockImplementation(async (url: string) => response(url.includes("count=true")
      ? { success: true, unreadCount: 7 }
      : { success: true, data: [row("read", true), row("next")], pagination: { hasMore: false } }));
    await act(async () => result.current.fetchNotifications({ limit: 2, offset: 2, unreadOnly: true }));
    expect(mocks.get).toHaveBeenCalledWith("/api/notifications?limit=2&offset=2&unreadOnly=true");
    expect(result.current.notifications.map(n => n.id)).toEqual(["unread", "read", "next"]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.unreadCount).toBe(7);
  });

  it("marks a notification read only after server acknowledgement and decrements once", async () => {
    const { result } = await loadedHook();
    let finish!: (value: unknown) => void;
    mocks.put.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.markAsRead("unread"); });
    expect(result.current.notifications[0].is_read).toBe(false);
    expect(result.current.unreadCount).toBe(7);
    await act(async () => { finish(response({ success: true })); await pending; });
    expect(mocks.put).toHaveBeenCalledWith("/api/notifications", { notificationId: "unread", read: true });
    expect(result.current.notifications[0].is_read).toBe(true);
    expect(result.current.unreadCount).toBe(6);
    await act(async () => { await result.current.markAsRead("unread"); });
    expect(result.current.unreadCount).toBe(6);
  });

  it("uses the server mark-all contract", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.markAllAsRead(); });
    expect(mocks.put).toHaveBeenCalledWith("/api/notifications", { markAllAsRead: true });
    expect(result.current.notifications.every(n => n.is_read)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("deletes with notificationId and updates the unread badge for an unread row", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.deleteNotification("unread"); });
    expect(mocks.remove).toHaveBeenCalledWith("/api/notifications", { notificationId: "unread" });
    expect(result.current.notifications.map(n => n.id)).toEqual(["read"]);
    expect(result.current.unreadCount).toBe(6);
  });

  it.each(["read", "all", "delete"])("preserves state and surfaces a failed %s mutation", async kind => {
    const { result } = await loadedHook();
    const failure = { ok: false, status: 503, error: "Service unavailable" };
    mocks.put.mockResolvedValue(failure);
    mocks.remove.mockResolvedValue(failure);
    let succeeded = true;
    await act(async () => {
      succeeded = await (kind === "read" ? result.current.markAsRead("unread")
        : kind === "all" ? result.current.markAllAsRead() : result.current.deleteNotification("unread"));
    });
    expect(succeeded).toBe(false);
    expect(result.current.notifications.map(n => n.is_read)).toEqual([false, true]);
    expect(result.current.unreadCount).toBe(7);
    expect(result.current.error).toBe("Service unavailable");
  });

  it("keeps existing rows on a failed refresh and reports the error", async () => {
    const { result } = await loadedHook();
    mocks.get.mockRejectedValueOnce(new Error("Network unavailable"));
    await act(async () => { await result.current.fetchNotifications(); });
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(7);
    expect(result.current.error).toBe("Network unavailable");
    expect(result.current.loading).toBe(false);
  });

  it("does not replace the global count with a page count when the count endpoint fails", async () => {
    const { result } = await loadedHook();
    mocks.get.mockImplementation(async (url: string) => url.includes("count=true")
      ? { ok: false, status: 503, error: "Count unavailable" }
      : response({ success: true, data: [row("next")], pagination: { hasMore: false } }));
    await act(async () => { await result.current.fetchNotifications(); });
    expect(result.current.notifications.map(n => n.id)).toEqual(["next"]);
    expect(result.current.unreadCount).toBe(7);
    expect(result.current.error).toBe("Count unavailable");
  });

  it("reports unavailable push delivery without requesting permission, collecting tokens or posting", async () => {
    Platform.OS = "android";
    const registration = await registerForPushNotifications();
    expect(registration).toMatchObject({ enabled: false, reason: "unavailable" });
    expect(registration.message).toContain("not available yet");
    expect(mocks.channel).toHaveBeenCalledWith("default", expect.objectContaining({ name: "eStories notifications" }));
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("clears private notifications on logout and ignores a late refresh", async () => {
    const { result, rerender } = await loadedHook();
    let finish!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.fetchNotifications(); });
    mocks.owner = null;
    rerender();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    await act(async () => { finish(response({ success: true, data: [row("late-private")], pagination: { hasMore: false } })); await pending; });
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
});

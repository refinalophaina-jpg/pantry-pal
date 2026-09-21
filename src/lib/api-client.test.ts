import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, invalidateApiRequests, ApiError } from "./api-client";
const fetchMock = vi.fn();
beforeEach(() => { invalidateApiRequests(); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe("application API transport", () => {
  it("rejects unexpected HTML instead of pretending data loaded", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>app</html>", { headers: { "content-type": "text/html" } }));
    await expect(apiRequest("/api/me")).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("preserves typed status/code/details from errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "conflict", message: "Changed elsewhere", details: { revision: 3 } } }), { status: 409, headers: { "content-type": "application/json" } }));
    await expect(apiRequest("/api/test")).rejects.toMatchObject({ status: 409, code: "conflict", details: { revision: 3 } });
  });
  it("sends cookies and excludes response caches", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { headers: { "content-type": "application/json" } }));
    await apiRequest("/api/test", { method: "POST", body: { name: "Rice" } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store", body: '{"name":"Rice"}' });
  });
  it("ignores late identity-scoped responses even if fetch ignores abort", async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const request = apiRequest("/api/test");
    invalidateApiRequests();
    finish(new Response("{}", { headers: { "content-type": "application/json" } }));
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
  it("keeps separately generation-guarded auth bootstrap alive", async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const request = apiRequest("/api/auth/get-session", { identityScoped: false });
    invalidateApiRequests();
    finish(new Response("{}", { headers: { "content-type": "application/json" } }));
    await expect(request).resolves.toEqual({});
  });
  it("does not accept an external request path", async () => {
    await expect(apiRequest("https://example.com/api/me")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

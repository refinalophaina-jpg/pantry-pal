import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins/anonymous";
import { guestRecovery } from "./guest-auth";

type AuthEnv = Pick<Env, "DB" | "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "AUTH_EMAIL_FROM" | "AUTH_EMAIL_ENABLED"> & Partial<Pick<Env, "EMAIL">>;
type BackgroundContext = Pick<ExecutionContext, "waitUntil">;

function canonicalOrigin(env: AuthEnv): string {
  const url = new URL(env.BETTER_AUTH_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("BETTER_AUTH_URL must be the canonical HTTPS origin (HTTP is allowed only on localhost).");
  }
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  return url.origin;
}

function emailConfigured(env: AuthEnv): boolean {
  return Boolean(String(env.AUTH_EMAIL_ENABLED) === "true" && env.EMAIL && typeof env.EMAIL.send === "function" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.AUTH_EMAIL_FROM));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

async function sendAuthEmail(env: AuthEnv, to: string, url: string, purpose: "verify" | "reset", ctx?: BackgroundContext): Promise<void> {
  const sender = env.EMAIL;
  if (!emailConfigured(env) || !sender) throw new Error("Authentication email delivery is not configured.");
  const title = purpose === "verify" ? "Verify your Pantry Pal email" : "Reset your Pantry Pal password";
  const action = purpose === "verify" ? "Verify email" : "Reset password";
  const explanation = purpose === "verify"
    ? "Verify your email to finish creating your Pantry Pal account. This link expires in one hour."
    : "Use this link to choose a new Pantry Pal password. This link expires in 30 minutes and can be used once.";
  const delivery = sender.send({
    to,
    from: { email: env.AUTH_EMAIL_FROM, name: "Pantry Pal" },
    subject: title,
    text: `${explanation}\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<h1>${title}</h1><p>${explanation}</p><p><a href="${escapeHtml(url)}">${action}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  }).then(() => undefined).catch(() => {
    // Provider errors may contain recipient addresses or message contents.
    console.error(JSON.stringify({ event: "auth_email_delivery_failed", purpose }));
    throw new Error("Authentication email could not be delivered.");
  });
  // Explicit scheduling also covers the library's resend endpoint. No token,
  // recipient, or password is logged or returned to the calling browser.
  if (ctx) ctx.waitUntil(delivery);
  else await delivery;
}

/** One factory per request: bindings, origin and background work stay request scoped. */
export function createAuth(_request: Request, env: AuthEnv, ctx?: BackgroundContext) {
  const origin = canonicalOrigin(env);
  return betterAuth({
    appName: "Pantry Pal",
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: [origin],
    // Library exceptions can contain adapter bindings or credential-bearing
    // diagnostics. Retain severity only, including background auth errors.
    logger: { log: (level) => {
      if (level === "error" || level === "warn") console.error(JSON.stringify({ event: "auth_library_event", level }));
    } },
    plugins: [anonymous({ disableDeleteAnonymousUser: true, generateName: () => "Guest" }), guestRecovery(env)],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => sendAuthEmail(env, user.email, url, "reset", ctx),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: ({ user, url }) => sendAuthEmail(env, user.email, url, "verify", ctx),
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
        "/sign-in/anonymous": { window: 60, max: 5 },
        "/guest/recover": { window: 60, max: 5 },
        "/guest/recovery-code": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "pantry",
      useSecureCookies: origin.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      ...(ctx ? { backgroundTasks: { handler: (task: Promise<unknown>) => ctx.waitUntil(task) } } : {}),
    },
    // Better Auth keeps its CSRF/origin checks enabled. Do not enable cookie
    // sharing across subdomains or native wildcard origins here.
  });
}

/** Domain routes use a fresh D1-backed session check, including revocation. */
export async function getSession(request: Request, env: AuthEnv) {
  return createAuth(request, env).api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
}

export async function handleAuth(request: Request, env: AuthEnv, ctx?: BackgroundContext): Promise<Response> {
  const origin = canonicalOrigin(env);
  const url = new URL(request.url);
  const problem = (status: number, code: string, message: string) => Response.json({ code, message }, { status, headers: { "Cache-Control": "no-store" } });
  if (url.origin !== origin) return problem(403, "INVALID_ORIGIN", "Use the configured Pantry Pal address.");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("Origin") !== origin) {
    return problem(403, "INVALID_ORIGIN", "This request must come from Pantry Pal.");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") return problem(415, "INVALID_CONTENT_TYPE", "Send a JSON request.");
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16_384) { await reader.cancel(); return problem(413, "BODY_TOO_LARGE", "Authentication request is too large."); }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = new TextDecoder().decode(bytes);
    let payload: unknown;
    try { payload = JSON.parse(body); } catch { return problem(400, "INVALID_JSON", "Send a valid JSON request."); }
    if (payload && typeof payload === "object") {
      for (const key of ["callbackURL", "redirectTo", "errorCallbackURL", "newUserCallbackURL"]) {
        const value = Reflect.get(payload, key);
        if (value !== undefined) {
          try {
            if (typeof value !== "string") throw new Error("Invalid callback");
            const callback = new URL(value, origin);
            if (callback.origin !== origin || callback.username || callback.password) throw new Error("Invalid callback");
          } catch { return problem(403, "INVALID_CALLBACK_URL", "Return links must stay on Pantry Pal."); }
        }
      }
    }
    request = new Request(request, { body });
  }
  const emailPaths = ["/api/auth/sign-up/email", "/api/auth/request-password-reset", "/api/auth/send-verification-email"];
  if (emailPaths.includes(url.pathname.replace(/\/$/, "")) && !emailConfigured(env)) {
    return problem(503, "AUTH_EMAIL_UNAVAILABLE", "Email verification and password recovery are temporarily unavailable. Please try again later.");
  }
  const response = await createAuth(request, env, ctx).handler(request);
  response.headers.set("Cache-Control", "no-store");
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    // Sessions are cookie-only. Better Auth's default JSON includes bearer
    // tokens; our browser does not need them, including for guest restoration.
    const withoutTokens = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(withoutTokens);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "token").map(([key, child]) => [key, withoutTokens(child)]));
      return value;
    };
    const body = await response.text();
    // Verification redirects can carry a JSON content type with no body.
    if (!body) return new Response(null, { status: response.status, headers: response.headers });
    response.headers.delete("Content-Length");
    return Response.json(withoutTokens(JSON.parse(body)), { status: response.status, headers: response.headers });
  }
  return response;
}

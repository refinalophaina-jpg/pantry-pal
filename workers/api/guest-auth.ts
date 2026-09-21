import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

type GuestEnv = Pick<Env, "DB">;
const recoveryError = () => new APIError("UNAUTHORIZED", { code: "INVALID_RECOVERY_CODE", message: "Recovery code is invalid or has been replaced." });

async function digest(code: string): Promise<string> {
  const normalized = code.toLowerCase().replace(/[\s-]/g, "");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function newRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const code = `PPG-${hex.match(/.{8}/g)!.join("-")}`;
  return { code, hash: await digest(code) };
}

/** Recovery is a bearer credential. Only its SHA-256 digest reaches D1. */
export function guestRecovery(env: GuestEnv) {
  return {
    id: "pantry-guest-recovery",
    endpoints: {
      rotateGuestRecovery: createAuthEndpoint("/guest/recovery-code", { method: "POST", use: [sessionMiddleware] }, async ctx => {
        const { user, session } = ctx.context.session;
        if (user.isAnonymous !== true) throw new APIError("FORBIDDEN", { code: "GUEST_REQUIRED", message: "Recovery codes are available only for guest accounts." });
        const recovery = await newRecoveryCode();
        const now = new Date().toISOString();
        // Recheck the session in the same statement: recovery may have revoked
        // this browser after the middleware's initial authentication check.
        const row = await env.DB.prepare('INSERT INTO guest_recovery(user_id,secret_hash,created_at,updated_at) SELECT id,?,?,? FROM "user" WHERE id=? AND "isAnonymous"=1 AND EXISTS(SELECT 1 FROM "session" WHERE id=? AND "userId"=? AND "expiresAt">?) ON CONFLICT(user_id) DO UPDATE SET secret_hash=excluded.secret_hash,updated_at=excluded.updated_at RETURNING user_id')
          .bind(recovery.hash, now, now, user.id, session.id, user.id, now).first();
        if (!row) throw new APIError("FORBIDDEN", { code: "GUEST_REQUIRED", message: "Recovery codes are available only for guest accounts." });
        return ctx.json({ recoveryCode: recovery.code });
      }),
      recoverGuest: createAuthEndpoint("/guest/recover", { method: "POST", body: z.object({ code: z.string().max(256) }) }, async ctx => {
        const hash = await digest(ctx.body.code);
        const normalized = ctx.body.code.toLowerCase().replace(/[\s-]/g, "");
        const match = await env.DB.prepare('SELECT r.user_id FROM guest_recovery r JOIN "user" u ON u.id=r.user_id WHERE r.secret_hash=? AND u."isAnonymous"=1').bind(hash).first<{ user_id: string }>();
        if (!/^ppg[0-9a-f]{64}$/.test(normalized) || !match) throw recoveryError();
        const user = await ctx.context.internalAdapter.findUserById(match.user_id);
        if (!user || Reflect.get(user, "isAnonymous") !== true) throw recoveryError();
        const recovery = await newRecoveryCode();
        // Let Better Auth own random session tokens, expiry, signing and cookies.
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Recovery could not complete. Please retry." });
        try {
          const [claim] = await env.DB.batch([
            env.DB.prepare('UPDATE guest_recovery SET secret_hash=?,updated_at=? WHERE user_id=? AND secret_hash=? AND EXISTS(SELECT 1 FROM "user" WHERE id=? AND "isAnonymous"=1) RETURNING user_id')
              .bind(recovery.hash, new Date().toISOString(), user.id, hash, user.id),
            env.DB.prepare('DELETE FROM "session" WHERE "userId"=? AND id<>? AND EXISTS(SELECT 1 FROM guest_recovery WHERE user_id=? AND secret_hash=?)')
              .bind(user.id, session.id, user.id, recovery.hash),
          ]);
          // A concurrent recovery or code rotation can win only once.
          if (!claim.results.length) throw recoveryError();
        } catch (error) {
          await ctx.context.internalAdapter.deleteSession(session.token);
          throw error;
        }
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ recoveryCode: recovery.code });
      }),
    },
  } satisfies BetterAuthPlugin;
}

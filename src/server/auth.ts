require("dotenv").config();
import { createClerkClient } from "@clerk/backend";
import Koa from "koa";

const PUBLIC_API_PATHS = new Set(["/leaderboard", "/match-summary"]);

export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

export const authMiddleware = async (ctx: Koa.Context, next: Koa.Next) => {
  if (PUBLIC_API_PATHS.has(ctx.path)) {
    await next();
    return;
  }

  const req = new Request(ctx.request.href, {
    method: ctx.request.method,
    headers: new Headers(ctx.request.headers as Record<string, string>),
  });
  const res = await clerkClient.authenticateRequest(req, {
    authorizedParties: ["http://localhost:3000", "https://www.playghq.com"],
  });
  const { isSignedIn, status, reason, message } = res;

  if (!isSignedIn) {
    console.error({ msg: "Failed to authenticate.", status, reason, message });
    ctx.status = 401;
    ctx.body = { status: 401, message: "Unauthorized" };
    return;
  }

  ctx.state.auth = res.toAuth();

  await next();
};

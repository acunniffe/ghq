require("dotenv").config();
import { createClerkClient } from "@clerk/backend";
import Koa from "koa";

const PUBLIC_API_ROUTES: Array<{
  exactPath?: string;
  pathRegex?: RegExp;
  method: string;
}> = [
  { exactPath: "/leaderboard", method: "GET" },
  { exactPath: "/match-summary", method: "GET" },
  { exactPath: "/matches", method: "GET" },
  { pathRegex: /^\/v3\/match\/[^/]+$/, method: "GET" },
  { pathRegex: /^\/v3\/match\/[^/]+\/turns$/, method: "GET" },
];

export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

export const authMiddleware = async (ctx: Koa.Context, next: Koa.Next) => {
  for (const route of PUBLIC_API_ROUTES) {
    if (route.exactPath === ctx.path && route.method === ctx.request.method) {
      await next();
      return;
    }
    if (
      route.pathRegex &&
      ctx.path.match(route.pathRegex) &&
      route.method === ctx.request.method
    ) {
      await next();
      return;
    }
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

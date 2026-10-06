import { safeEqual } from "@/lib/calendar/crypto";
import { listConnections, syncAndRenew } from "@/lib/calendar/google";

export const maxDuration = 300;

// Daily (vercel.json): a catch-up sync in case a ping was lost, and renewal of
// the push channel, which Google ends after about a week.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

  const connections = await listConnections();
  const results = await Promise.all(connections.map((c) => syncAndRenew(c)));
  return Response.json({ ok: results.every(Boolean), connections: connections.length });
}

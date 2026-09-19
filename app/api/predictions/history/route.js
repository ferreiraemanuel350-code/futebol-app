import { getRedis } from "../../../../lib/redis";

export async function GET() {
  const redis = getRedis();
  try {
    const ids = await redis.lrange("pred:index", 0, 199);
    if (!ids.length) return Response.json({ records: [], stats: { total: 0, hits: 0, accuracy: 0 } });

    const keys = ids.map((id) => `pred:${id}`);
    const raw = await redis.mget(keys);
    const records = raw
      .filter(Boolean)
      .map((r) => JSON.parse(r))
      .filter((r) => r.resolved)
      .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));

    const hits = records.filter((r) => r.hit).length;
    const total = records.length;
    const accuracy = total ? (hits / total) * 100 : 0;

    return Response.json({ records, stats: { total, hits, accuracy } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

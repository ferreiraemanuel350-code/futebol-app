import { getRedis } from "../../../../lib/redis";

export async function POST(request) {
  const redis = getRedis();
  try {
    const { matches } = await request.json();
    let resolved = 0;

    for (const m of matches) {
      const key = `pred:${m.id}`;
      const existingRaw = await redis.get(key);
      if (!existingRaw) continue;

      const existing = JSON.parse(existingRaw);
      if (existing.resolved) continue;

      const homeGoals = m.homeGoals;
      const awayGoals = m.awayGoals;
      const actual = homeGoals > awayGoals ? "casa" : awayGoals > homeGoals ? "fora" : "empate";
      const predicted =
        existing.pHome >= existing.pDraw && existing.pHome >= existing.pAway
          ? "casa"
          : existing.pAway >= existing.pDraw
          ? "fora"
          : "empate";

      const updated = {
        ...existing,
        resolved: true,
        homeGoals,
        awayGoals,
        actual,
        predicted,
        hit: actual === predicted,
        resolvedAt: new Date().toISOString(),
      };
      await redis.set(key, JSON.stringify(updated));
      resolved++;
    }

    return Response.json({ resolved });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

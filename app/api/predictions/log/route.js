import { getRedis } from "../../../../lib/redis";

export async function POST(request) {
  const redis = getRedis();
  try {
    const { matches } = await request.json();
    let saved = 0;

    for (const m of matches) {
      const key = `pred:${m.id}`;
      const record = {
        id: m.id,
        league: m.league,
        home: m.home,
        away: m.away,
        date: m.date,
        pHome: m.pHome,
        pDraw: m.pDraw,
        pAway: m.pAway,
        likelyScore: m.likelyScore,
        loggedAt: new Date().toISOString(),
        resolved: false,
      };
      const result = await redis.set(key, JSON.stringify(record), "NX");
      if (result === "OK") {
        await redis.lpush("pred:index", m.id);
        saved++;
      }
    }

    return Response.json({ saved });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

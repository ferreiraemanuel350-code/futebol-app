import { kv } from "@vercel/kv";

export async function POST(request) {
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
      const wasSet = await kv.set(key, JSON.stringify(record), { nx: true });
      if (wasSet) {
        await kv.lpush("pred:index", m.id);
        saved++;
      }
    }

    return Response.json({ saved });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

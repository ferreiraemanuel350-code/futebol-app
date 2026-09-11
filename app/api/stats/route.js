const BASE_URL = "https://v3.football.api-sports.io";

async function searchTeam(query, headers) {
  const res = await fetch(`${BASE_URL}/teams?search=${encodeURIComponent(query)}`, {
    headers,
    next: { revalidate: 604800 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.response?.[0]?.team?.id ?? null;
}

async function resolveTeamId(name, headers) {
  // A API-Football costuma cadastrar os times sem sufixos como "FC", "AFC", "CF".
  // Tenta o nome original e depois variações mais "limpas" até encontrar.
  const variants = [
    name,
    name.replace(/\s+(FC|CF|AFC|SC|AC)$/i, ""),
    name.replace(/^(FC|AFC|CF|SC|AC)\s+/i, ""),
    name.split(" ")[0],
  ];

  for (const variant of variants) {
    if (!variant || variant.length < 3) continue;
    const id = await searchTeam(variant, headers);
    if (id) return id;
  }
  return null;
}


async function teamAverages(teamId, headers) {
  const fixturesRes = await fetch(`${BASE_URL}/fixtures?team=${teamId}&last=5`, {
    headers,
    next: { revalidate: 21600 },
  });
  if (!fixturesRes.ok) return null;
  const fixturesData = await fixturesRes.json();
  const fixtures = fixturesData.response ?? [];

  const statsPromises = fixtures.map((f) =>
    fetch(`${BASE_URL}/fixtures/statistics?fixture=${f.fixture.id}&team=${teamId}`, {
      headers,
      next: { revalidate: 21600 },
    }).then((r) => r.json())
  );
  const allStats = await Promise.all(statsPromises);

  const totals = { corners: 0, fouls: 0, shotsOnGoal: 0, throwIns: 0 };
  let count = 0;
  allStats.forEach((statResult) => {
    const teamStats = statResult.response?.[0]?.statistics;
    if (!teamStats) return;
    count++;
    teamStats.forEach((s) => {
      const type = (s.type || "").toLowerCase();
      const value = typeof s.value === "number" ? s.value : parseInt(s.value) || 0;
      if (type.includes("corner")) totals.corners += value;
      if (type.includes("fouls")) totals.fouls += value;
      if (type.includes("shots on goal")) totals.shotsOnGoal += value;
      if (type.includes("throw")) totals.throwIns += value;
    });
  });

  if (!count) return null;
  return {
    corners: totals.corners / count,
    fouls: totals.fouls / count,
    shotsOnGoal: totals.shotsOnGoal / count,
    throwIns: totals.throwIns / count,
    sampleSize: count,
  };
}

export async function GET(request) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return Response.json({ error: "API_FOOTBALL_KEY não configurada." }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const home = searchParams.get("home");
  const away = searchParams.get("away");
  if (!home || !away) {
    return Response.json({ error: "Informe os parâmetros home e away." }, { status: 400 });
  }

  const headers = { "x-apisports-key": apiKey };

  try {
    const [homeId, awayId] = await Promise.all([
      resolveTeamId(home, headers),
      resolveTeamId(away, headers),
    ]);

    if (!homeId || !awayId) {
      return Response.json({ error: "Não encontrei um dos times na API-Football." }, { status: 404 });
    }

    const [homeStats, awayStats] = await Promise.all([
      teamAverages(homeId, headers),
      teamAverages(awayId, headers),
    ]);

    if (!homeStats || !awayStats) {
      return Response.json({ error: "Sem jogos recentes suficientes para estimar." }, { status: 404 });
    }

    return Response.json({ home: homeStats, away: awayStats });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

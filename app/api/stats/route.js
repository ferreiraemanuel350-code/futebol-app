const BASE_URL = "https://v3.football.api-sports.io";

function currentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? year : year - 1;
}

async function searchTeam(query, headers) {
  const res = await fetch(`${BASE_URL}/teams?search=${encodeURIComponent(query)}`, {
    headers,
    next: { revalidate: 604800 },
  });
  if (res.status === 429) throw new Error("QUOTA");
  if (res.status === 401 || res.status === 403) throw new Error("AUTH");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data = await res.json();
  return data.response?.[0]?.team?.id ?? null;
}

async function resolveTeamId(name, headers) {
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

function parseValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace("%", "").trim();
  return parseInt(cleaned) || 0;
}

async function teamAverages(teamId, headers) {
  const season = currentSeason();
  const fixturesRes = await fetch(`${BASE_URL}/fixtures?team=${teamId}&last=5&season=${season}`, {
    headers,
    next: { revalidate: 21600 },
  });
  if (fixturesRes.status === 429) throw new Error("QUOTA");
  if (fixturesRes.status === 401 || fixturesRes.status === 403) throw new Error("AUTH");
  if (!fixturesRes.ok) throw new Error(`HTTP_${fixturesRes.status}`);
  const fixturesData = await fixturesRes.json();
  const fixtures = fixturesData.response ?? [];
  if (!fixtures.length) return null;

  const statsPromises = fixtures.map((f) =>
    fetch(`${BASE_URL}/fixtures/statistics?fixture=${f.fixture.id}&team=${teamId}`, {
      headers,
      next: { revalidate: 21600 },
    }).then((r) => r.json())
  );
  const allStats = await Promise.all(statsPromises);

  const totals = {
    corners: 0, fouls: 0, shotsOnGoal: 0, throwIns: 0, totalShots: 0, shotsOff: 0,
    possession: 0, possessionCount: 0, yellowCards: 0, redCards: 0, offsides: 0, saves: 0,
    passAccuracy: 0, passAccuracyCount: 0,
  };
  let count = 0;

  allStats.forEach((statResult) => {
    const teamStats = statResult.response?.[0]?.statistics;
    if (!teamStats) return;
    count++;
    teamStats.forEach((s) => {
      const type = (s.type || "").toLowerCase();
      const value = parseValue(s.value);
      if (type.includes("corner")) totals.corners += value;
      if (type.includes("fouls")) totals.fouls += value;
      if (type === "shots on goal") totals.shotsOnGoal += value;
      if (type.includes("throw")) totals.throwIns += value;
      if (type === "total shots") totals.totalShots += value;
      if (type === "shots off goal") totals.shotsOff += value;
      if (type.includes("ball possession")) {
        totals.possession += value;
        totals.possessionCount++;
      }
      if (type.includes("yellow")) totals.yellowCards += value;
      if (type.includes("red")) totals.redCards += value;
      if (type.includes("offside")) totals.offsides += value;
      if (type.includes("goalkeeper saves")) totals.saves += value;
      if (type === "passes %") {
        totals.passAccuracy += value;
        totals.passAccuracyCount++;
      }
    });
  });

  if (!count) return null;
  return {
    corners: totals.corners / count,
    fouls: totals.fouls / count,
    shotsOnGoal: totals.shotsOnGoal / count,
    throwIns: totals.throwIns / count,
    totalShots: totals.totalShots / count,
    shotsOff: totals.shotsOff / count,
    possession: totals.possessionCount ? totals.possession / totals.possessionCount : null,
    yellowCards: totals.yellowCards / count,
    redCards: totals.redCards / count,
    offsides: totals.offsides / count,
    saves: totals.saves / count,
    passAccuracy: totals.passAccuracyCount ? totals.passAccuracy / totals.passAccuracyCount : null,
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
    const [homeId, awayId] = await Promise.all([resolveTeamId(home, headers), resolveTeamId(away, headers)]);
    if (!homeId || !awayId) {
      return Response.json({ error: "Não encontrei um dos times na API-Football (nome não localizado)." }, { status: 404 });
    }

    const [homeStats, awayStats] = await Promise.all([teamAverages(homeId, headers), teamAverages(awayId, headers)]);
    if (!homeStats || !awayStats) {
      return Response.json({ error: "Sem jogos da temporada atual disponíveis para um dos times ainda." }, { status: 404 });
    }

    return Response.json({ home: homeStats, away: awayStats });
  } catch (err) {
    if (err.message === "QUOTA") {
      return Response.json({ error: "Limite diário da API-Football atingido. Tente de novo amanhã." }, { status: 429 });
    }
    if (err.message === "AUTH") {
      return Response.json({ error: "Chave da API-Football recusada (401/403) — confira se a chave em API_FOOTBALL_KEY na Vercel está certa e se o Pro foi ativado nela." }, { status: 403 });
    }
    return Response.json({ error: `Erro inesperado: ${err.message}` }, { status: 500 });
  }
}

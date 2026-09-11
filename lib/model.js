// Modelo de Poisson com força de ataque/defesa (casa e fora separados) + forma recente.
// Não usa odds de casas de apostas — é uma estimativa estatística própria.

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonPMF(k, lambda) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function average(nums) {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function findRow(table, teamName) {
  return table.find((r) => r.team.name === teamName);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function leagueAverages(standings) {
  const avgGoalsHome = average(
    standings.home.filter((t) => t.playedGames > 0).map((t) => t.goalsFor / t.playedGames)
  );
  const avgGoalsAway = average(
    standings.away.filter((t) => t.playedGames > 0).map((t) => t.goalsFor / t.playedGames)
  );
  return {
    avgGoalsHome: avgGoalsHome || 1.4,
    avgGoalsAway: avgGoalsAway || 1.1,
  };
}

function recentForm(matches, teamName, n = 5) {
  const played = matches
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        (m.homeTeam.name === teamName || m.awayTeam.name === teamName)
    )
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .slice(0, n);
  if (!played.length) return null;
  let gf = 0;
  let ga = 0;
  played.forEach((m) => {
    const isHome = m.homeTeam.name === teamName;
    gf += isHome ? m.score.fullTime.home : m.score.fullTime.away;
    ga += isHome ? m.score.fullTime.away : m.score.fullTime.home;
  });
  return { gf: gf / played.length, ga: ga / played.length, n: played.length };
}

export function estimateMatch(standings, matches, homeName, awayName) {
  // Tenta a tabela específica de casa/fora; se o time ainda não tiver jogos
  // suficientes registrados ali (comum no início da temporada), cai para a tabela geral.
  let homeRow = findRow(standings.home, homeName);
  if (!homeRow || !homeRow.playedGames) homeRow = findRow(standings.total, homeName);

  let awayRow = findRow(standings.away, awayName);
  if (!awayRow || !awayRow.playedGames) awayRow = findRow(standings.total, awayName);

  if (!homeRow || !awayRow || !homeRow.playedGames || !awayRow.playedGames) return null;

  const { avgGoalsHome, avgGoalsAway } = leagueAverages(standings);
  const overallAvg = (avgGoalsHome + avgGoalsAway) / 2;

  const homeAttack = homeRow.goalsFor / homeRow.playedGames / avgGoalsHome;
  const homeDefense = homeRow.goalsAgainst / homeRow.playedGames / avgGoalsAway;
  const awayAttack = awayRow.goalsFor / awayRow.playedGames / avgGoalsAway;
  const awayDefense = awayRow.goalsAgainst / awayRow.playedGames / avgGoalsHome;

  let expHome = avgGoalsHome * homeAttack * awayDefense;
  let expAway = avgGoalsAway * awayAttack * homeDefense;

  const homeRecent = recentForm(matches, homeName, 5);
  const awayRecent = recentForm(matches, awayName, 5);
  if (homeRecent && awayRecent) {
    const expHomeRecent = avgGoalsHome * (homeRecent.gf / overallAvg) * (awayRecent.ga / overallAvg);
    const expAwayRecent = avgGoalsAway * (awayRecent.gf / overallAvg) * (homeRecent.ga / overallAvg);
    expHome = expHome * 0.6 + expHomeRecent * 0.4;
    expAway = expAway * 0.6 + expAwayRecent * 0.4;
  }

  expHome = clamp(expHome, 0.15, 4.5);
  expAway = clamp(expAway, 0.15, 4.5);

  const maxGoals = 8;
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let best = { h: 0, a: 0, p: 0 };

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPMF(h, expHome) * poissonPMF(a, expAway);
      if (h > a) pHome += p;
      else if (h < a) pAway += p;
      else pDraw += p;
      if (p > best.p) best = { h, a, p };
    }
  }

  const total = pHome + pDraw + pAway;

  return {
    pHome: (pHome / total) * 100,
    pDraw: (pDraw / total) * 100,
    pAway: (pAway / total) * 100,
    expectedGoalsHome: expHome,
    expectedGoalsAway: expAway,
    expectedTotalGoals: expHome + expAway,
    likelyScore: `${best.h}-${best.a}`,
    sampleSize: { home: homeRecent?.n ?? 0, away: awayRecent?.n ?? 0 },
  };
}

export function rankBiggestAdvantages(upcomingMatches, allMatches, standings, limit = 8) {
  const ranked = upcomingMatches
    .map((m) => {
      const est = estimateMatch(standings, allMatches, m.homeTeam.name, m.awayTeam.name);
      if (!est) return null;
      const favored = est.pHome >= est.pAway ? "casa" : "fora";
      const edge = Math.max(est.pHome, est.pAway);
      return { match: m, estimate: est, favored, edge };
    })
    .filter(Boolean)
    .sort((a, b) => b.edge - a.edge);
  return ranked.slice(0, limit);
}

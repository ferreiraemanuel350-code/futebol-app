// Modelo simples baseado no histórico da temporada (pontos e saldo de gols por jogo).
// Não usa dados de odds nem de casas de apostas — é só uma estimativa estatística.

const HOME_ADVANTAGE = 0.28; // vantagem de jogar em casa, em "pontos de força"

function teamStrength(standingRow) {
  if (!standingRow || !standingRow.playedGames) return null;
  const played = standingRow.playedGames;
  const ppg = standingRow.points / played;
  const gdpg = (standingRow.goalsFor - standingRow.goalsAgainst) / played;
  return {
    strength: ppg + gdpg * 0.5,
    avgGoalsFor: standingRow.goalsFor / played,
    avgGoalsAgainst: standingRow.goalsAgainst / played,
  };
}

// Retorna probabilidades (%) e gols esperados para uma partida, a partir da tabela.
export function estimateMatch(standings, homeName, awayName) {
  const homeRow = standings.find((s) => s.team.name === homeName);
  const awayRow = standings.find((s) => s.team.name === awayName);
  const home = teamStrength(homeRow);
  const away = teamStrength(awayRow);
  if (!home || !away) return null;

  const diff = home.strength + HOME_ADVANTAGE - away.strength;
  const pHomeWin = 1 / (1 + Math.exp(-diff * 1.3));
  const drawFactor = Math.max(0.14, 0.32 - Math.abs(diff) * 0.06);
  const pHome = pHomeWin * (1 - drawFactor);
  const pAway = (1 - pHomeWin) * (1 - drawFactor);
  const total = pHome + drawFactor + pAway;

  const expectedGoalsHome = (home.avgGoalsFor + away.avgGoalsAgainst) / 2;
  const expectedGoalsAway = (away.avgGoalsFor + home.avgGoalsAgainst) / 2;

  return {
    pHome: (pHome / total) * 100,
    pDraw: (drawFactor / total) * 100,
    pAway: (pAway / total) * 100,
    expectedGoalsHome,
    expectedGoalsAway,
    expectedTotalGoals: expectedGoalsHome + expectedGoalsAway,
  };
}

// Dado um conjunto de partidas futuras + a tabela, retorna a lista ordenada
// pela maior vantagem estimada (maior probabilidade de vitória de um dos lados).
export function rankBiggestAdvantages(matches, standings, limit = 8) {
  const ranked = matches
    .map((m) => {
      const est = estimateMatch(standings, m.homeTeam.name, m.awayTeam.name);
      if (!est) return null;
      const favored = est.pHome >= est.pAway ? "casa" : "fora";
      const edge = Math.max(est.pHome, est.pAway);
      return { match: m, estimate: est, favored, edge };
    })
    .filter(Boolean)
    .sort((a, b) => b.edge - a.edge);
  return ranked.slice(0, limit);
}

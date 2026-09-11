"use client";

import { useState, useEffect, useCallback } from "react";
import { estimateMatch, rankBiggestAdvantages } from "../lib/model";

const LEAGUES = [
  { code: "PL", label: "Premier League" },
  { code: "PD", label: "La Liga" },
  { code: "SA", label: "Serie A" },
  { code: "BL1", label: "Bundesliga" },
  { code: "FL1", label: "Ligue 1" },
  { code: "BSA", label: "Brasileirão" },
  { code: "CL", label: "Champions League" },
];

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function outcome(hs, as) {
  if (hs > as) return "casa";
  if (as > hs) return "fora";
  return "empate";
}

export default function Page() {
  const [league, setLeague] = useState("PL");
  const [tab, setTab] = useState("resultados");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [advantages, setAdvantages] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [statsByMatch, setStatsByMatch] = useState({});

  const load = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    setAdvantages(null);
    setStatsByMatch({});
    try {
      const res = await fetch(`/api/league/${code}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao carregar dados.");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(league);
  }, [league, load]);

  const standings = data?.standings ?? { total: [], home: [], away: [] };
  const allMatches = data?.matches ?? [];

  const results = allMatches
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .slice(0, 12);

  const upcoming = allMatches
    .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    .slice(0, 12);

  function handleAdvantages() {
    setCalculating(true);
    setTimeout(() => {
      setAdvantages(rankBiggestAdvantages(upcoming, allMatches, standings, 8));
      setTab("vantagens");
      setCalculating(false);
    }, 250);
  }

  async function loadMatchStats(match) {
    setStatsByMatch((prev) => ({ ...prev, [match.id]: { loading: true } }));
    try {
      const res = await fetch(
        `/api/stats?home=${encodeURIComponent(match.homeTeam.name)}&away=${encodeURIComponent(match.awayTeam.name)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não consegui calcular.");
      setStatsByMatch((prev) => ({ ...prev, [match.id]: { data: json } }));
    } catch (e) {
      setStatsByMatch((prev) => ({ ...prev, [match.id]: { error: e.message } }));
    }
  }

  return (
    <div className="app">
      <div className="masthead">
        <h1>Boletim de Resultados</h1>
        <p>Resultados, tabela e estimativas — dados ao vivo da football-data.org</p>
      </div>

      <div className="league-tabs">
        {LEAGUES.map((l) => (
          <button
            key={l.code}
            className={"league-tab " + (league === l.code ? "active" : "")}
            onClick={() => setLeague(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <button className="advantage-btn" onClick={handleAdvantages} disabled={loading || calculating || upcoming.length === 0}>
        {calculating ? "Calculando…" : "⚡ Gerar times com maior vantagem de vitória"}
      </button>

      {error && <div className="error-msg">{error}</div>}

      <div className="view-tabs">
        <button className={"view-tab " + (tab === "resultados" ? "active" : "")} onClick={() => setTab("resultados")}>
          Resultados
        </button>
        <button className={"view-tab " + (tab === "proximos" ? "active" : "")} onClick={() => setTab("proximos")}>
          Próximas partidas
        </button>
        <button className={"view-tab " + (tab === "tabela" ? "active" : "")} onClick={() => setTab("tabela")}>
          Tabela
        </button>
        {advantages && (
          <button className={"view-tab " + (tab === "vantagens" ? "active" : "")} onClick={() => setTab("vantagens")}>
            Maiores vantagens
          </button>
        )}
      </div>

      {loading && <div className="state-msg">Carregando dados…</div>}

      {!loading && tab === "resultados" &&
        results.map((m) => {
          const res = outcome(m.score.fullTime.home, m.score.fullTime.away);
          return (
            <div className="row" key={m.id}>
              <span className="row-date">{fmtDate(m.utcDate)}</span>
              <span className={"row-team " + (res === "casa" ? "win" : res === "empate" ? "draw" : "")}>
                {m.homeTeam.name}
              </span>
              <span className="row-score">
                {m.score.fullTime.home} – {m.score.fullTime.away}
              </span>
              <span className={"row-team right " + (res === "fora" ? "win" : res === "empate" ? "draw" : "")}>
                {m.awayTeam.name}
              </span>
            </div>
          );
        })}

      {!loading && tab === "proximos" &&
        upcoming.map((m) => {
          const est = estimateMatch(standings, allMatches, m.homeTeam.name, m.awayTeam.name);
          const statState = statsByMatch[m.id];
          return (
            <div className="up-row" key={m.id}>
              <div className="up-top">
                <span>{fmtDate(m.utcDate)}</span>
                <span className="up-teams">
                  {m.homeTeam.name} <span className="vs">vs</span> {m.awayTeam.name}
                </span>
              </div>
              {est ? (
                <>
                  <div className="bar">
                    <div className="seg seg-h" style={{ width: `${est.pHome}%` }} />
                    <div className="seg seg-d" style={{ width: `${est.pDraw}%` }} />
                    <div className="seg seg-a" style={{ width: `${est.pAway}%` }} />
                  </div>
                  <div className="up-bottom">
                    <span>{est.pHome.toFixed(0)}%</span>
                    <span>{est.pDraw.toFixed(0)}% empate</span>
                    <span>{est.pAway.toFixed(0)}%</span>
                  </div>
                  <div className="up-goals">
                    Gols esperados: {est.expectedGoalsHome.toFixed(1)} – {est.expectedGoalsAway.toFixed(1)} · placar
                    provável {est.likelyScore}
                  </div>
                </>
              ) : (
                <div className="up-goals">Dados insuficientes para estimativa.</div>
              )}

              {!statState && (
                <button className="stats-btn" onClick={() => loadMatchStats(m)}>
                  Ver escanteios / faltas / chutes
                </button>
              )}
              {statState?.loading && <div className="up-goals">Calculando…</div>}
              {statState?.error && <div className="error-msg">{statState.error}</div>}
              {statState?.data && (
                <div className="stats-panel">
                  <div className="stats-title">Média dos últimos jogos (combinado dos 2 times)</div>
                  <div className="stats-grid">
                    <div className="stats-item">
                      <span className="stats-num">
                        {(statState.data.home.corners + statState.data.away.corners).toFixed(1)}
                      </span>
                      <span className="stats-label">Escanteios</span>
                    </div>
                    <div className="stats-item">
                      <span className="stats-num">
                        {(statState.data.home.fouls + statState.data.away.fouls).toFixed(1)}
                      </span>
                      <span className="stats-label">Faltas</span>
                    </div>
                    <div className="stats-item">
                      <span className="stats-num">
                        {(statState.data.home.shotsOnGoal + statState.data.away.shotsOnGoal).toFixed(1)}
                      </span>
                      <span className="stats-label">Chutes a gol</span>
                    </div>
                    <div className="stats-item">
                      <span className="stats-num">
                        {(statState.data.home.throwIns + statState.data.away.throwIns).toFixed(1)}
                      </span>
                      <span className="stats-label">Laterais</span>
                    </div>
                  </div>
                  <div className="stats-sub">
                    Baseado nos últimos {statState.data.home.sampleSize} jogos de {m.homeTeam.name} e{" "}
                    {statState.data.away.sampleSize} de {m.awayTeam.name}.
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {!loading && tab === "tabela" && (
        <div className="table-wrap">
          <div className="table-head">
            <span className="pos">#</span>
            <span className="team">Time</span>
            <span>V</span>
            <span>E</span>
            <span>D</span>
            <span>Pts</span>
          </div>
          {standings.total.map((s) => (
            <div className="table-row" key={s.team.id}>
              <span className="pos">{s.position}</span>
              <span className="team">{s.team.name}</span>
              <span>{s.won}</span>
              <span>{s.draw}</span>
              <span>{s.lost}</span>
              <span className="pts">{s.points}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "vantagens" && advantages && (
        <>
          {advantages.length === 0 && <div className="state-msg">Nenhuma partida futura disponível para estimar.</div>}
          {advantages.map(({ match, estimate, favored, edge }) => (
            <div className="advantage-card" key={match.id}>
              <div className="advantage-top">
                <span className="advantage-teams">
                  {match.homeTeam.name} <span className="vs">vs</span> {match.awayTeam.name}
                </span>
                <span className="advantage-pct">{edge.toFixed(0)}%</span>
              </div>
              <div className="advantage-sub">
                Favorito: {favored === "casa" ? match.homeTeam.name : match.awayTeam.name} ({favored}) · {fmtDate(match.utcDate)} · placar
                provável {estimate.likelyScore}
              </div>
            </div>
          ))}
        </>
      )}

      <p className="footnote">
        Estimativas calculadas com um modelo de Poisson (ataque/defesa por casa/fora + forma recente) e médias
        históricas de escanteios/faltas/chutes/laterais — não usam odds de casas de apostas, não são garantia de
        resultado e não são recomendação de aposta. A API de estatísticas detalhadas tem cota limitada (100
        consultas/dia), então use com moderação.
      </p>
    </div>
  );
}

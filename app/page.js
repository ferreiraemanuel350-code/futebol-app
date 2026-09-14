
"use client";

import { useState, useEffect, useCallback } from "react";
import { estimateMatch, rankBiggestAdvantages, bestPickOfDay } from "../lib/model";

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

function isWeekend(iso) {
  const day = new Date(iso).getDay();
  return day === 0 || day === 6;
}

function Crest({ src, alt }) {
  if (!src) return null;
  return <img className="crest" src={src} alt={alt} onError={(e) => (e.currentTarget.style.display = "none")} />;
}

function StarButton({ team, favorites, onToggle }) {
  const fav = favorites.includes(team);
  return (
    <button
      className={"star-btn " + (fav ? "active" : "")}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(team);
      }}
      aria-label="favoritar time"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 2l2.9 6.6 7.1.6-5.4 4.6 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z" />
      </svg>
    </button>
  );
}

function TeamTag({ name, crest, favorites, onToggleFavorite }) {
  return (
    <span className="team-cell">
      <StarButton team={name} favorites={favorites} onToggle={onToggleFavorite} />
      <Crest src={crest} alt="" />
      <span className="team-name">{name}</span>
    </span>
  );
}

function NavIcon({ name, active }) {
  const props = { viewBox: "0 0 24 24", width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "resultados") return <svg {...props}><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
  if (name === "proximos") return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
  if (name === "tabela") return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>;
  if (name === "favoritos")
    return (
      <svg viewBox="0 0 24 24" width={22} height={22} fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 2l2.9 6.6 7.1.6-5.4 4.6 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z" />
      </svg>
    );
  if (name === "mais") return <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>;
  return null;
}

export default function Page() {
  const [league, setLeague] = useState("PL");
  const [section, setSection] = useState("resultados");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [advantages, setAdvantages] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [statsByMatch, setStatsByMatch] = useState({});
  const [bestPick, setBestPick] = useState(null);
  const [calculatingBest, setCalculatingBest] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("todos");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("favoriteTeams");
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  function toggleFavorite(name) {
    setFavorites((prev) => {
      const next = prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name];
      try {
        window.localStorage.setItem("favoriteTeams", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const load = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    setAdvantages(null);
    setBestPick(null);
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

  const filteredUpcoming = upcoming.filter((m) => {
    if (dateFilter === "fim") return isWeekend(m.utcDate);
    if (dateFilter === "meio") return !isWeekend(m.utcDate);
    return true;
  });

  const favResults = results.filter((m) => favorites.includes(m.homeTeam.name) || favorites.includes(m.awayTeam.name));
  const favUpcoming = upcoming.filter((m) => favorites.includes(m.homeTeam.name) || favorites.includes(m.awayTeam.name));

  function handleAdvantages() {
    setCalculating(true);
    setTimeout(() => {
      setAdvantages(rankBiggestAdvantages(upcoming, allMatches, standings, 8));
      setSection("vantagens");
      setSheetOpen(false);
      setCalculating(false);
    }, 250);
  }

  function handleBestPick() {
    setCalculatingBest(true);
    setTimeout(() => {
      const picks = bestPickOfDay(upcoming, allMatches, standings, 1);
      setBestPick(picks[0] ?? null);
      setSheetOpen(false);
      setCalculatingBest(false);
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

  function ResultRow(m) {
    const res = outcome(m.score.fullTime.home, m.score.fullTime.away);
    return (
      <div className="row" key={m.id}>
        <span className="row-date">{fmtDate(m.utcDate)}</span>
        <span className={res === "casa" ? "win" : res === "empate" ? "draw" : ""}>
          <TeamTag name={m.homeTeam.name} crest={m.homeTeam.crest} favorites={favorites} onToggleFavorite={toggleFavorite} />
        </span>
        <span className="row-score">
          {m.score.fullTime.home} – {m.score.fullTime.away}
        </span>
        <span className={"right " + (res === "fora" ? "win" : res === "empate" ? "draw" : "")}>
          <TeamTag name={m.awayTeam.name} crest={m.awayTeam.crest} favorites={favorites} onToggleFavorite={toggleFavorite} />
        </span>
      </div>
    );
  }

  function UpcomingRow(m) {
    const est = estimateMatch(standings, allMatches, m.homeTeam.name, m.awayTeam.name);
    const statState = statsByMatch[m.id];
    return (
      <div className="up-row" key={m.id}>
        <div className="up-top">
          <span>{fmtDate(m.utcDate)}</span>
          <span className="up-teams">
            <TeamTag name={m.homeTeam.name} crest={m.homeTeam.crest} favorites={favorites} onToggleFavorite={toggleFavorite} />
            <span className="vs">vs</span>
            <TeamTag name={m.awayTeam.name} crest={m.awayTeam.crest} favorites={favorites} onToggleFavorite={toggleFavorite} />
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
            <div className="prediction-card">
              <div className="prediction-goals">
                <span className="prediction-num">{est.expectedGoalsHome.toFixed(1)}</span>
                <span className="prediction-label">gols esperados</span>
                <span className="prediction-num">{est.expectedGoalsAway.toFixed(1)}</span>
              </div>
              <div className="prediction-score">Placar provável: <strong>{est.likelyScore}</strong></div>
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
                <span className="stats-num">{(statState.data.home.corners + statState.data.away.corners).toFixed(1)}</span>
                <span className="stats-label">Escanteios</span>
              </div>
              <div className="stats-item">
                <span className="stats-num">{(statState.data.home.fouls + statState.data.away.fouls).toFixed(1)}</span>
                <span className="stats-label">Faltas</span>
              </div>
              <div className="stats-item">
                <span className="stats-num">{(statState.data.home.shotsOnGoal + statState.data.away.shotsOnGoal).toFixed(1)}</span>
                <span className="stats-label">Chutes a gol</span>
              </div>
              <div className="stats-item">
                <span className="stats-num">{(statState.data.home.throwIns + statState.data.away.throwIns).toFixed(1)}</span>
                <span className="stats-label">Laterais</span>
              </div>
            </div>
            <div className="stats-sub">
              Baseado nos últimos {statState.data.home.sampleSize} jogos de {m.homeTeam.name} e {statState.data.away.sampleSize} de {m.awayTeam.name}.
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentLeagueLabel = LEAGUES.find((l) => l.code === league)?.label ?? "";

  return (
    <div className="app">
      <div className="topbar">
        <span className="topbar-title">⚽ Boletim</span>
        <button className="league-chip" onClick={() => setSheetOpen(true)}>
          {currentLeagueLabel} <span className="chevron">▾</span>
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {bestPick && (
        <div className="bestpick-card">
          <div className="bestpick-label">Palpite com maior probabilidade estimada</div>
          <div className="bestpick-teams">
            <span className="team-cell plain"><Crest src={bestPick.match.homeTeam.crest} alt="" />{bestPick.match.homeTeam.name}</span>
            <span className="vs">vs</span>
            <span className="team-cell plain"><Crest src={bestPick.match.awayTeam.crest} alt="" />{bestPick.match.awayTeam.name}</span>
          </div>
          <div className="bestpick-market">{bestPick.market}</div>
          <div className="bestpick-prob">{bestPick.prob.toFixed(0)}%</div>
          <div className="bestpick-date">{fmtDate(bestPick.match.utcDate)}</div>
        </div>
      )}

      <div className="content">
        {loading && <div className="state-msg">Carregando dados…</div>}

        {!loading && section === "resultados" && results.map(ResultRow)}

        {!loading && section === "proximos" && (
          <>
            <div className="date-tabs">
              <button className={"date-tab " + (dateFilter === "todos" ? "active" : "")} onClick={() => setDateFilter("todos")}>Todos</button>
              <button className={"date-tab " + (dateFilter === "meio" ? "active" : "")} onClick={() => setDateFilter("meio")}>Meio de semana</button>
              <button className={"date-tab " + (dateFilter === "fim" ? "active" : "")} onClick={() => setDateFilter("fim")}>Fim de semana</button>
            </div>
            {filteredUpcoming.length === 0 && <div className="state-msg">Nenhum jogo nesse período.</div>}
            {filteredUpcoming.map(UpcomingRow)}
          </>
        )}

        {!loading && section === "tabela" && (
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
                <span className="team">
                  <TeamTag name={s.team.name} crest={s.team.crest} favorites={favorites} onToggleFavorite={toggleFavorite} />
                </span>
                <span>{s.won}</span>
                <span>{s.draw}</span>
                <span>{s.lost}</span>
                <span className="pts">{s.points}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && section === "favoritos" && (
          <>
            {favorites.length === 0 && (
              <div className="state-msg">Toque na estrela ☆ ao lado de um time pra favoritar e vê-lo aqui.</div>
            )}
            {favorites.length > 0 && favResults.length === 0 && favUpcoming.length === 0 && (
              <div className="state-msg">Nenhum jogo de time favorito nesta liga no momento.</div>
            )}
            {favResults.length > 0 && <div className="section-label">Resultados</div>}
            {favResults.map(ResultRow)}
            {favUpcoming.length > 0 && <div className="section-label">Próximas partidas</div>}
            {favUpcoming.map(UpcomingRow)}
          </>
        )}

        {!loading && section === "vantagens" && advantages && (
          <>
            {advantages.length === 0 && <div className="state-msg">Nenhuma partida futura disponível para estimar.</div>}
            {advantages.map(({ match, estimate, favored, edge }) => (
              <div className="advantage-card" key={match.id}>
                <div className="advantage-top">
                  <span className="advantage-teams">
                    <span className="team-cell plain"><Crest src={match.homeTeam.crest} alt="" />{match.homeTeam.name}</span>
                    <span className="vs">vs</span>
                    <span className="team-cell plain"><Crest src={match.awayTeam.crest} alt="" />{match.awayTeam.name}</span>
                  </span>
                  <span className="advantage-pct">{edge.toFixed(0)}%</span>
                </div>
                <div className="advantage-sub">
                  Favorito: {favored === "casa" ? match.homeTeam.name : match.awayTeam.name} ({favored}) · {fmtDate(match.utcDate)} · placar provável {estimate.likelyScore}
                </div>
              </div>
            ))}
          </>
        )}

        <p className="footnote">
          Estimativas calculadas com um modelo de Poisson (ataque/defesa por casa/fora + forma recente) e médias
          históricas de escanteios/faltas/chutes/laterais — não usam odds de casas de apostas, não são garantia de
          resultado e não são recomendação de aposta.
        </p>
      </div>

      <div className="bottomnav">
        {[
          { id: "resultados", label: "Resultados" },
          { id: "proximos", label: "Próximos" },
          { id: "tabela", label: "Tabela" },
          { id: "favoritos", label: "Favoritos" },
        ].map((item) => (
          <button
            key={item.id}
            className={"nav-btn " + (section === item.id ? "active" : "")}
            onClick={() => setSection(item.id)}
          >
            <NavIcon name={item.id} active={section === item.id} />
            <span>{item.label}</span>
          </button>
        ))}
        <button className={"nav-btn " + (sheetOpen ? "active" : "")} onClick={() => setSheetOpen(true)}>
          <NavIcon name="mais" />
          <span>Mais</span>
        </button>
      </div>

      {sheetOpen && (
        <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-section-title">Escolher liga</div>
            <div className="sheet-leagues">
              {LEAGUES.map((l) => (
                <button
                  key={l.code}
                  className={"league-tab " + (league === l.code ? "active" : "")}
                  onClick={() => {
                    setLeague(l.code);
                    setSheetOpen(false);
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="sheet-section-title">Ferramentas</div>
            <button className="sheet-action advantage" onClick={handleAdvantages} disabled={loading || calculating || upcoming.length === 0}>
              {calculating ? "Calculando…" : "⚡ Times com maior vantagem"}
            </button>
            <button className="sheet-action bestpick" onClick={handleBestPick} disabled={loading || calculatingBest || upcoming.length === 0}>
              {calculatingBest ? "Calculando…" : "🎯 Aposta do dia"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

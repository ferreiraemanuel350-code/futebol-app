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
              <div className="stats-i

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
  if (name === "proximos") return <svg {...props}><rect x="3" y="5"

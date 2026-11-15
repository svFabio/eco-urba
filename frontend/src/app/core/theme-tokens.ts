export const HEAT_RISK_COLORS: Record<string, string> = {
  Bajo: '#4caf50',
  Moderado: '#ffeb3b',
  Alto: '#ff9800',
  Crítico: '#f44336',
  Default: '#8b5cf6',
};

export const CANOPY_GOAL_PCT = 44.0;

export const CANOPY_COLOR_RAMP = [
  { minCanopy: 30, color: '#15803d' },
  { minCanopy: 20, color: '#22c55e' },
  { minCanopy: 15, color: '#84cc16' },
  { minCanopy: 10, color: '#eab308' },
  { minCanopy: 0, color: '#f97316' },
];

export const CANOPY_GOAL_COLORS = {
  met: '#16a34a',
  notMet: '#f43f5e',
};

export const DEFAULT_POLYGON_STYLE: L.PathOptions = {
  color: '#ffffff',
  weight: 1.5,
  opacity: 0.9,
  fillColor: '#94a3b8',
  fillOpacity: 0.45,
};

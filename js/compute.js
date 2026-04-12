// === compute.js ===
// Klimatické výpočty — 8 ukazatelů

window.ClimateApp = window.ClimateApp || {};

ClimateApp.compute = (function () {

  // ── Thornthwaite latitude correction at ~50°N ──────────────────
  const LAT_CORRECTION_50N = [0.84, 0.83, 1.03, 1.11, 1.24, 1.25, 1.27, 1.21, 1.04, 0.96, 0.83, 0.81];

  // ── 1. De Martonne aridity index ───────────────────────────────
  // AI = R / (T + 10)
  function deMartonne(R, T) {
    if (T == null || R == null) return null;
    if (T <= -10) return null;
    return R / (T + 10);
  }

  // ── 2. Lang's rain factor ──────────────────────────────────────
  // LDF = R / T  (meaningful only for T > 0)
  function langLDF(R, T) {
    if (T == null || R == null) return null;
    if (T <= 0) return null;
    return R / T;
  }

  // ── 3. PET Thornthwaite (monthly, with lat. correction) ────────
  // Returns 12 monthly PET values [mm]
  function petThornthwaiteMonthly(temps) {
    if (!Array.isArray(temps) || temps.length !== 12) return Array(12).fill(null);

    const ij = temps.map(T => (T > 0 ? Math.pow(T / 5, 1.514) : 0));
    const I = ij.reduce((s, v) => s + v, 0);
    if (I === 0) return Array(12).fill(0);

    const a = (6.75e-7 * Math.pow(I, 3)) - (7.71e-5 * Math.pow(I, 2)) + (1.792e-2 * I) + 0.49239;

    return temps.map((T, m) => {
      if (T <= 0) return 0;
      const raw = 16 * Math.pow((10 * T) / I, a);
      return raw * LAT_CORRECTION_50N[m];
    });
  }

  // Annual PET = sum of monthly
  function petThornthwaite(temps) {
    const monthly = petThornthwaiteMonthly(temps);
    if (!monthly || monthly.some(v => v === null)) return null;
    return monthly.reduce((s, v) => s + v, 0);
  }

  // ── 4. VPD — Vapor Pressure Deficit ───────────────────────────
  // SVP = 0.6108 × exp(17.27 × T / (T + 237.3))  [kPa]
  // AVP = SVP × RH / 100
  // VPD = SVP - AVP
  function vpd(T, RH) {
    if (T == null || RH == null) return null;
    const svp = 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
    const avp = svp * RH / 100;
    return svp - avp;
  }

  // ── 5. MVJ — Minářova vláhová jistota ─────────────────────────
  // Vegetační období = měsíce 4–9 (index 3–8)
  // MVJ = (SRA_veg - PET_veg) / PET_veg × 100
  function mvj(monthlyTemps, monthlySRA) {
    if (!Array.isArray(monthlyTemps) || !Array.isArray(monthlySRA)) return null;
    const petMonthly = petThornthwaiteMonthly(monthlyTemps);

    const vegIdx = [3, 4, 5, 6, 7, 8]; // April–September (0-indexed)
    const SRA_veg = vegIdx.reduce((s, i) => s + (monthlySRA[i] || 0), 0);
    const PET_veg = vegIdx.reduce((s, i) => s + (petMonthly[i] || 0), 0);

    if (PET_veg === 0) return null;
    return ((SRA_veg - PET_veg) / PET_veg) * 100;
  }

  // ── 6. KIZ — Končekův index zavlažení ─────────────────────────
  // Léto = měsíce 6–8 (index 5–7)
  // KIZ = SRA_léto - 0.8 × PET_léto
  function kiz(monthlyTemps, monthlySRA) {
    if (!Array.isArray(monthlyTemps) || !Array.isArray(monthlySRA)) return null;
    const petMonthly = petThornthwaiteMonthly(monthlyTemps);

    const sumIdx = [5, 6, 7]; // June–August (0-indexed)
    const SRA_sum = sumIdx.reduce((s, i) => s + (monthlySRA[i] || 0), 0);
    const PET_sum = sumIdx.reduce((s, i) => s + (petMonthly[i] || 0), 0);

    return SRA_sum - 0.8 * PET_sum;
  }

  // ── Compute all indicators for each normal ─────────────────────
  function computeForIndicator(climateData, indicatorKey) {
    if (!climateData || !Array.isArray(climateData.normals)) return [];

    const normals = climateData.normals;
    const oldNormal = normals.find(n => n.key === 'old');

    return normals.map(n => {
      let idx = null;

      switch (indicatorKey) {
        case 'demartonne':
          idx = n.de_martonne != null ? n.de_martonne : deMartonne(n.R, n.T);
          break;

        case 'ldf':
          idx = langLDF(n.R, n.T);
          break;

        case 'pet':
          idx = n.pet != null ? n.pet : petThornthwaite(n.monthlyTemps || []);
          break;

        case 'vpd':
          // Requires rh_avg — may be null until backend is updated
          idx = vpd(n.T, n.rh_avg != null ? n.rh_avg : n.RH);
          break;

        case 'mvj':
          idx = mvj(n.monthlyTemps || [], n.monthlySRA || []);
          break;

        case 'kiz':
          idx = kiz(n.monthlyTemps || [], n.monthlySRA || []);
          break;

        case 'deltasra':
          // Delta vs old normal baseline
          if (n.key === 'old') {
            idx = 0;
          } else if (oldNormal && n.R != null && oldNormal.R != null) {
            idx = n.R - oldNormal.R;
          }
          break;

        case 'deltat':
          // Delta vs old normal baseline
          if (n.key === 'old') {
            idx = 0;
          } else if (oldNormal && n.T != null && oldNormal.T != null) {
            idx = n.T - oldNormal.T;
          }
          break;
      }

      return {
        key: n.key,
        label: n.label,
        T: n.T,
        R: n.R,
        index: idx,
        de_martonne: n.de_martonne,
        pet: n.pet,
        monthlyTemps: n.monthlyTemps,
        monthlySRA: n.monthlySRA,
      };
    });
  }

  // ── Compute differences between normals ────────────────────────
  function computeDifferences(results) {
    const out = {};
    const byKey = {};
    results.forEach(r => (byKey[r.key] = r));

    const old = byKey['old'];
    const now = byKey['new'];
    const fut = byKey['future'];

    if (old && now) {
      out.oldNew = {
        label: 'Nový − Starý',
        deltaIndex: safeDiff(now.index, old.index),
        deltaT: safeDiff(now.T, old.T),
        deltaR: safeDiff(now.R, old.R),
      };
    }
    if (now && fut) {
      out.newFuture = {
        label: 'Predikce 2050 − Nový',
        deltaIndex: safeDiff(fut.index, now.index),
        deltaT: safeDiff(fut.T, now.T),
        deltaR: safeDiff(fut.R, now.R),
      };
    }
    return out;
  }

  function safeDiff(a, b) {
    if (a == null || b == null) return null;
    return a - b;
  }

  return {
    deMartonne,
    langLDF,
    petThornthwaite,
    petThornthwaiteMonthly,
    vpd,
    mvj,
    kiz,
    computeForIndicator,
    computeDifferences,
  };
})();

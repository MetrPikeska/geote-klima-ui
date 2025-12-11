// === compute.js ===
// Modul pro výpočet klimatických ukazatelů

window.ClimateApp = window.ClimateApp || {};

ClimateApp.compute = (function () {

  /**
   * De Martonne aridity index
   * AI = R / (T + 10)
   * R – roční úhrn srážek [mm]
   * T – průměrná roční teplota [°C]
   */
  function deMartonne(R, T) {
    if (T == null || R == null) return null;
    if (T <= -10) return null;
    return R / (T + 10);
  }

  /**
   * PET Thornthwaite – zjednodušený model podle zadání.
   *
   * temps = pole 12 měsíčních teplot [°C]
   * Vrací: součet měsíční PET = roční PET [mm]
   */
  function petThornthwaite(temps) {
    if (!Array.isArray(temps) || temps.length !== 12) return null;

    // Měsíční indexy: i_j = (Tj / 5) ^ 1.514 (jen pro T > 0)
    const ij = temps.map((T) => {
      if (T <= 0) return 0;
      return Math.pow(T / 5, 1.514);
    });

    const I = ij.reduce((sum, v) => sum + v, 0);

    if (I === 0) return 0;

    // Exponent a
    const a =
      (0.0675 * Math.pow(I, 3) +
        7.71 * Math.pow(I, 2) +
        1792 * I +
        47239) *
      1e-5;

    // Měsíční PET bez korekce dne
    // E0 = 16 * (10 * T / I)^a
    const monthlyPET = temps.map((T) => {
      if (T <= 0) return 0;
      const term = (10 * T) / I;
      return 16 * Math.pow(term, a);
    });

    // Roční PET
    return monthlyPET.reduce((sum, v) => sum + v, 0);
  }

  /**
   * Výpočet indexů pro jednotlivé normály.
   * climateData.normals = [{ key, label, T, R, monthlyTemps, de_martonne, pet }]
   */
  function computeForIndicator(climateData, indicatorKey) {
    if (!climateData || !Array.isArray(climateData.normals)) return [];

    return climateData.normals.map((n) => {
      let idx = null;

      switch (indicatorKey) {
        case "demartonne":
          idx = n.de_martonne || deMartonne(n.R, n.T);
          break;

        case "pet":
          idx = n.pet || petThornthwaite(n.monthlyTemps || []);
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
      };
    });
  }

  /**
   * Výpočet rozdílů mezi normály:
   * (new - old) a (future - new)
   */
  function computeDifferences(results) {
    const out = {};
    const byKey = {};

    results.forEach((r) => (byKey[r.key] = r));

    const old = byKey["old"];
    const now = byKey["new"];
    const fut = byKey["future"];

    if (old && now) {
      out.oldNew = {
        label: "Nový - Starý",
        deltaIndex: safeDiff(now.index, old.index),
        deltaT: safeDiff(now.T, old.T),
        deltaR: safeDiff(now.R, old.R),
      };
    }

    if (now && fut) {
      out.newFuture = {
        label: "Predikce 2050 - Nový",
        deltaIndex: safeDiff(fut.index, now.index),
        deltaT: safeDiff(fut.T, now.T),
        deltaR: safeDiff(fut.R, now.R),
      };
    }

    return out;
  }

  /** Bezpečné odečítání */
  function safeDiff(a, b) {
    if (a == null || b == null) return null;
    return a - b;
  }

  return {
    deMartonne,
    petThornthwaite,
    computeForIndicator,
    computeDifferences,
  };
})();

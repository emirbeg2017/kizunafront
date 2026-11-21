export const coefficientOfVariation = (values) => {
  const scores = values.filter(Number.isFinite);
  const count = scores.length;
  const mean = count ? scores.reduce((sum, score) => sum + score, 0) / count : null;
  const standardDeviation = count > 1
    ? Math.sqrt(scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / (count - 1))
    : null;

  return {
    count,
    mean,
    standardDeviation,
    cv: standardDeviation !== null && mean > 0 ? standardDeviation / mean * 100 : null,
  };
};

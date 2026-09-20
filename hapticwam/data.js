// Transcribed from source/sections/Experiments.tex, revision 2026-09-20.
export const models = [
  { name: 'Teacher', color: '#8b9485', counts: [14, 12, 4], forces: [[16.7, 4.7, 13], [11.4, 1.4, 12], [24.9, 9.2, 5]] },
  { name: 'Student', color: '#27695f', counts: [19, 17, 5], forces: [[14.3, 3.6, 19], [11.8, 2.2, 16], [18.8, 9.1, 6]] },
  { name: 'π₀.₅', color: '#8b9485', counts: [4, 6, 0], forces: [[13.4, 2, 5], [16, 4.9, 5], [null, null, 0]] },
  { name: 'Diffusion Policy', color: '#8b9485', counts: [2, 3, 4], forces: [[14.1, null, 1], [10.1, null, 2], [27.1, 3.1, 4]] },
];
export const tasks = ['waffles', 'carton', 'egg'];
export const taskLabels = { waffles: 'Waffles', carton: 'Carton', egg: 'Egg', pooled: 'All tasks · pooled' };
export const denominators = [20, 20, 10];
export const ablation = { intact: [9, 7, 5], zero: [1, 3, 0] };
export function wilson(k, n) {
  const z = 1.959963984540054, p = k / n, d = 1 + z * z / n;
  const middle = (p + z * z / (2 * n)) / d;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, middle - half), Math.min(1, middle + half)];
}

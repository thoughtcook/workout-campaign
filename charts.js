(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Charts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty = message => `<div class="empty">${escapeHtml(message)}</div>`;
  function table(headers, rows) {
    return `<table class="data"><thead><tr>${headers.map(h => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function barChart(labels, series, caption) {
    const width = 620, height = 230, left = 36, bottom = 188, plot = 150, step = (width - left - 15) / labels.length, max = Math.max(1, ...series.flatMap(s => s.values));
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(caption)}"><line x1="${left}" x2="610" y1="${bottom}" y2="${bottom}" stroke="#52694f"/>`;
    for (let i = 0; i < 3; i++) { const value = max * i / 2, y = bottom - plot * i / 2; svg += `<text x="27" y="${y + 4}" text-anchor="end">${Number(value.toFixed(1))}</text>`; }
    labels.forEach((label, i) => {
      const base = left + i * step + step * .12;
      series.forEach((s, j) => { const bw = step * .7 / series.length, v = s.values[i], h = v / max * plot; svg += `<rect x="${base + j * bw}" y="${bottom - h}" width="${bw - 3}" height="${h}" fill="${s.color}" rx="3"><title>${escapeHtml(label + ' ' + s.name + ': ' + v)}</title></rect>`; });
      svg += `<text x="${left + (i + .5) * step}" y="211" text-anchor="middle">${escapeHtml(label)}</text>`;
    });
    return svg + '</svg><p class="legend">' + series.map(s => `<span style="color:${s.color}">● ${escapeHtml(s.name)}</span>`).join('　') + '</p><details><summary>查看图表数据</summary><div class="table-scroll">' + table(['日期', ...series.map(s => s.name)], labels.map((l, i) => [l, ...series.map(s => s.values[i])])) + '</div></details>';
  }
  function lineChart(points, caption, color = '#c7e6ad') {
    if (!points.length) return empty('还没有可绘制的记录。');
    const w = 620, h = 235, l = 45, r = 590, b = 185, top = 25, max = Math.max(...points.map(p => p.value)), min = Math.min(...points.map(p => p.value));
    const padding = Math.max((max - min) * .15, max * .01, 1), lo = Math.max(0, min - padding), hi = max + padding;
    const xy = points.map((p, i) => ({x: points.length === 1 ? (l + r) / 2 : l + i * (r - l) / (points.length - 1), y: b - (p.value - lo) / (hi - lo) * (b - top), p}));
    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(caption)}"><text x="2" y="${top + 4}">${hi.toFixed(1)}</text><text x="2" y="${b}">${lo.toFixed(1)}</text><line x1="${l}" x2="${r}" y1="${b}" y2="${b}" stroke="#52694f"/><polyline fill="none" stroke="${color}" stroke-width="2" points="${xy.map(p => p.x + ',' + p.y).join(' ')}"/>`;
    xy.forEach(({x, y, p}, i) => { svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color}"><title>${escapeHtml(p.date + ': ' + p.value.toFixed(1))}</title></circle>`; if (i === 0 || i === xy.length - 1 || xy.length <= 6) svg += `<text x="${x}" y="211" text-anchor="middle">${escapeHtml(p.date.slice(5))}</text><text class="value" x="${x}" y="${y - 11}" text-anchor="middle">${Number(p.value.toFixed(1))}</text>`; });
    return svg + '</svg>';
  }
  return {empty, table, barChart, lineChart};
});

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SessionLogging = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metricUnit = e => e.metric === 'seconds' ? '秒' : '次';
  const loadText = (e, load) => ['body','band'].includes(e.loadUnit) ? (e.loadUnit === 'body' ? '徒手' : '弹力带') : load + ' kg' + (e.loadUnit === 'per-hand' ? ' / 单只' : e.loadUnit === 'assistance' ? ' / 辅助' : '');
  const setText = (e, s) => `${loadText(e, s.load)} × ${s.value} ${metricUnit(e)}${s.rir !== null && s.rir !== undefined ? ' · RIR ' + s.rir : ''}`;
  function compactSet(e, s) {
    const load = ['body','band'].includes(e.loadUnit) ? (e.loadUnit === 'body' ? '徒手' : '弹力带') : e.loadUnit === 'assistance' ? `辅助${s.load}kg` : `${s.load}kg`;
    return `${load}×${s.value}${s.rir !== null && s.rir !== undefined ? ` · 余${s.rir}` : ''}`;
  }
  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  function clockFromParts(parts) {
    const pick = type => parts.find(part => part.type === type)?.value ?? '';
    let hour = pick('hour'), minute = pick('minute');
    if (hour === '24') hour = '00';
    if (!/^\d{2}$/.test(hour) || !/^\d{2}$/.test(minute) || Number(hour) > 23 || Number(minute) > 59) throw new Error('时间格式无效');
    return hour + ':' + minute;
  }
  function formatZoneTime(iso, timeZone) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone, hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(new Date(iso));
    return clockFromParts(parts);
  }
  function lastComparableSet(previous, index) {
    if (!previous || !previous.exercise || !Array.isArray(previous.exercise.sets)) return null;
    const done = previous.exercise.sets.filter(s => s.done && s.load !== null && s.load !== undefined && s.value !== null && s.value !== undefined);
    if (!done.length || index < 0) return null;
    return done[Math.min(index, done.length - 1)];
  }
  function lastSetLabel(previous, index) {
    const set = lastComparableSet(previous, index);
    if (!set) return '';
    const done = previous.exercise.sets.filter(s => s.done && s.load !== null && s.load !== undefined && s.value !== null && s.value !== undefined);
    return `${index < done.length ? '上次' : '上次末组'} ${compactSet(previous.exercise, set)}`;
  }
  function describePrevious(exercise, previous, dateLabel) {
    if (!previous) return '尚无可比记录。先确认器械标识和单位，建立基线。';
    const done = previous.exercise.sets.filter(s => s.done);
    return `上次 ${dateLabel}：${done.map(s => setText(exercise, s)).join('；') || '没有勾选完成组'}`;
  }
  function stepSetField(set, field, delta, exercise) {
    if (field === 'load' && ['body','band'].includes(exercise.loadUnit)) return set.load;
    const min = field === 'load' ? 0 : 1, max = field === 'load' ? 1000 : 3600;
    const current = set[field];
    if (current === null || current === undefined || Number.isNaN(current)) return delta > 0 ? (min === 0 ? 1 : min) : null;
    let base = Number(current);
    if (field === 'value' && exercise.metric === 'reps') base = Math.round(base);
    const next = Math.round((base + delta) * 1000) / 1000;
    if (next < min || next > max) return current;
    if (field === 'value' && exercise.metric === 'reps' && !Number.isInteger(next)) return current;
    return next;
  }
  function copyPreviousLoads(exercise, previous) {
    if (!previous) return {ok:false, message:'没有同器械、同单位的可比记录，请先建立基线。'};
    const source = previous.exercise;
    if (source.pain === 'yes' || source.form === 'poor') return {ok:false, error:true, message:'上次记录有疼痛或动作不稳定，不沿用重量；先确认安全负荷。'};
    const sets = source.sets.filter(s => s.done);
    if (!sets.length) return {ok:false, message:'上次没有完成组，不能复制重量。'};
    exercise.sets.forEach((s, i) => { if (!s.done) s.load = sets[Math.min(i, sets.length - 1)].load; });
    return {ok:true, message:'只填入上次重量，次数和完成状态仍需如实记录。'};
  }
  return {escapeHtml, metricUnit, loadText, setText, compactSet, formatClock, clockFromParts, formatZoneTime, lastComparableSet, lastSetLabel, describePrevious, stepSetField, copyPreviousLoads};
});

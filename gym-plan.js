// Compatibility view for the existing dashboard while the journal UI is built.
(function () {
  'use strict';
  const root = document.getElementById('gym-plan');
  if (!root || !globalThis.Training) return;
  root.innerHTML = '<div class="section-head"><div><h2 class="section-title">健身房晨练计划 · 试行版</h2><p class="section-sub">每周 4 次力量，另选有氧与恢复日；器械配置待核实。</p></div><span class="chip">馆内 6:18–7:08</span></div>' +
    '<p class="hero-copy">6:10 出发 → 6:18 到馆 → 5 分钟专项热身 → 37 分钟力量 → 8 分钟活动度 → 7:08 离馆，约 7:16 到家。腿日可快走，交通用时相应调整；换衣洗澡另计。</p>' +
    '<label for="gym-day">选择课表：</label><select id="gym-day"></select><div id="gym-session"></div>' +
    '<details><summary>训练与进阶规则</summary><p>前 8 次力量训练，3 组动作先做 2 组。选择仍有约 3 次标准动作余力的重量。主要动作休息 90–120 秒，辅助动作 45–75 秒。连续两次在相同器械、重量和目标下全部达标、无痛且余力充分，再考虑最小档位加重。疲劳时减少一组或休息，不补课。</p></details>' +
    '<details><summary>活动度与髋部注意事项</summary><p>猫牛式 1 分钟；胸椎开书每侧 1 分钟；扶稳小范围髋旋转每侧 1 分钟；半跪髋前侧轻拉伸每侧 1 分钟；轻松走动与呼吸 1 分钟。不要反复制造弹响。出现疼痛、卡住或活动受限时停止诱发动作并寻求评估。</p></details>' +
    '<p class="section-sub">当前仍为课表展示；成长时间轴和逐组保存功能尚未接入。历史 log.json 保持不变。</p>';
  const selector = document.getElementById('gym-day');
  for (const plan of Training.plans) {
    const option = document.createElement('option');
    option.value = plan.id;
    option.textContent = plan.name + ' · ' + plan.focus;
    selector.appendChild(option);
  }
  const cardio = document.createElement('option');
  cardio.value = 'cardio';
  cardio.textContent = '可选日 · 有氧与活动度';
  selector.appendChild(cardio);
  function render() {
    const target = document.getElementById('gym-session');
    if (selector.value === 'cardio') {
      target.textContent = '5 分钟热身＋30 分钟舒适有氧＋10 分钟活动度＋5 分钟放松；可选单车、椭圆机或坡度步行，疲劳时缩短或休息。';
      return;
    }
    const plan = Training.plans.find(p => p.id === selector.value);
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th scope="col">动作</th><th scope="col">目标组数 × 次数</th><th scope="col">要点与替代</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const e of plan.exercises) {
      const row = document.createElement('tr');
      for (const value of [e.name, e.sets + ' × ' + e.low + '–' + e.high + (e.id === 'side-plank' ? ' 秒 / 每侧' : ' 次'), e.cue + (e.alternatives.length ? ' 替代：' + e.alternatives.join('、') : '')]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    table.appendChild(body);
    target.replaceChildren(table);
  }
  selector.addEventListener('change', render);
  render();
})();

export function calculateGrowth(stats = {}) {
  const entries = stats.entryCount || 0;
  const attachments = stats.attachmentCount || 0;
  const comments = stats.commentCount || 0;
  const periods = stats.periodCount || 0;
  const completedWishes = (stats.entries || []).filter(item => item.type === 'wish' && item.status === 'completed').length;
  const score = entries * 8 + attachments * 3 + comments * 2 + periods * 12 + completedWishes * 18;
  const level = entries === 0 ? 0 : Math.min(10, Math.max(1, Math.floor(Math.sqrt(score) / 3.2) + 1));
  const nextThreshold = Math.pow(level * 3.2, 2);
  const previousThreshold = Math.pow(Math.max(0, level - 1) * 3.2, 2);
  const progress = level >= 10 ? 100 : Math.max(0, Math.min(100, ((score - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)) * 100));
  return { level, score, progress, entries, attachments, comments, periods, completedWishes };
}

export function renderGrowthMeter(container, growth) {
  container.innerHTML = '';
  const label = document.createElement('strong');
  label.textContent = growth.level === 0 ? 'Bintang pertama belum lahir' : `Level Semesta ${growth.level}`;
  const track = document.createElement('div'); track.className = 'growth-meter__track';
  const bar = document.createElement('div'); bar.className = 'growth-meter__bar'; bar.style.width = `${growth.progress}%`; track.append(bar);
  const count = document.createElement('span'); count.className = 'muted'; count.textContent = `${growth.entries} cerita · ${growth.periods || 0} orbit · ${growth.attachments} lampiran`;
  container.append(label, track, count);
}

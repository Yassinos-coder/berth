import './style.css';

const INSTALL_CMD = 'curl -fsSL https://berth.sh | sudo bash';

const COPY_SVG =
  '<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

const btn = document.getElementById('copy-btn');
const label = document.getElementById('copy-label');
const icon = document.getElementById('copy-icon');

let timer: number | undefined;

btn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(INSTALL_CMD);
  } catch {
    const range = document.createRange();
    const node = document.getElementById('install-cmd');
    if (node) {
      range.selectNodeContents(node);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand('copy');
    }
  }

  if (label) label.textContent = 'Copied';
  if (icon) icon.innerHTML = CHECK_SVG;

  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (label) label.textContent = 'Copy';
    if (icon) icon.innerHTML = COPY_SVG;
  }, 1800);
});

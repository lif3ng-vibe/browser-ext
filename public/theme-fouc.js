/**
 * FOUC 阻塞脚本:popup/options 的 <head> 里 <script src> 同步引用(CSP 实测:
 * 内联 script 被 MV3 默认 CSP 拦,外链 'self' 允许)。必须在 Vue mount 前跑完。
 *
 * 策略三层:
 *  1. localStorage 镜像有解析值 → 直接用(常态,选过非默认主题的用户零闪烁)
 *  2. 镜像缺失 → matchMedia 猜系统明暗,取默认主题对的对应侧
 *  3. 任何异常 → 静态 light
 * useTheme onMounted 后会以 storage 真值校正。
 */
(function () {
  var resolved = null;
  try {
    var raw = localStorage.getItem('lif3ng:resolvedTheme');
    if (raw === 'light' || raw === 'dark' || raw === 'vercel-light' || raw === 'vercel-dark') {
      resolved = raw;
    }
  } catch {
    /* localStorage 不可用 */
  }
  if (!resolved) {
    try {
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved = dark ? 'dark' : 'light';
    } catch {
      resolved = 'light';
    }
  }
  var root = document.documentElement;
  root.dataset.theme = resolved;
  if (resolved === 'dark' || resolved === 'vercel-dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
})();
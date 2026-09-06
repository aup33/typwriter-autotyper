// ==UserScript==
// @name         Autotypper 
// @namespace    http://tampermonkey.net/
// @version      2026-09-06
// @description  just a typewriter cheat
// @author       You
// @match        https://*.typewriter.at/index.php?r=typewriter/runLevel
// @icon         https://www.google.com/s2/favicons?sz=64&domain=typewriter.at
// @grant        none
// ==/UserScript==

(() => {
  const SELECTOR = '#text_todo_1 > span';

  
  if (window.__autotyper) window.__autotyper.destroy();

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const STORE = 'autotyper.cfg';
  const KPM_MIN = 30, KPM_MAX = 100000;

  const cfg = {
    kpm: 300,        
    errorRate: 2,    
    correct: true,   
    manual: false,   
    hidden: false,   
    hotkey: { key: 'h', ctrl: true, shift: true, alt: false },
    running: false
  };

  
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    if (Number.isFinite(saved.kpm))       cfg.kpm = Math.min(KPM_MAX, Math.max(KPM_MIN, saved.kpm));
    if (Number.isFinite(saved.errorRate)) cfg.errorRate = Math.min(25, Math.max(0, saved.errorRate));
    if (typeof saved.correct === 'boolean') cfg.correct = saved.correct;
    if (typeof saved.manual  === 'boolean') cfg.manual  = saved.manual;
    if (typeof saved.hidden  === 'boolean') cfg.hidden  = saved.hidden;
    if (saved.hotkey && typeof saved.hotkey.key === 'string') cfg.hotkey = saved.hotkey;
  } catch (e) {  }

  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        kpm: cfg.kpm, errorRate: cfg.errorRate, correct: cfg.correct,
        manual: cfg.manual, hidden: cfg.hidden, hotkey: cfg.hotkey
      }));
    } catch (e) {  }
  };

  
  const posToKpm = p => Math.round(KPM_MIN * Math.pow(KPM_MAX / KPM_MIN, p / 1000));
  const kpmToPos = k => Math.round(1000 * Math.log(k / KPM_MIN) / Math.log(KPM_MAX / KPM_MIN));
  const fmtKpm = k => k >= 10000 ? Math.round(k / 1000) + 'k'
                    : k >= 1000  ? (k / 1000).toFixed(1) + 'k'
                    : String(k);

  

  let target = null;   

  
  const focusHandler = e => {
    if (panel.contains(e.target)) return;
    if (e.target && 'value' in e.target && e.target.matches('input, textarea')) target = e.target;
  };
  document.addEventListener('focusin', focusHandler, true);

  
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  };

  const keyInfo = (char) => {
    if (char === ' ')  return { key: ' ',     code: 'Space', keyCode: 32 };
    if (char === '\n') return { key: 'Enter', code: 'Enter', keyCode: 13 };
    if (/[a-zA-Z]/.test(char)) return { key: char, code: 'Key' + char.toUpperCase(), keyCode: char.toUpperCase().charCodeAt(0) };
    if (/[0-9]/.test(char))    return { key: char, code: 'Digit' + char, keyCode: char.charCodeAt(0) };
    return { key: char, code: '', keyCode: char.charCodeAt(0) };
  };

  const ensureFocus = () => {
    if (target && document.activeElement !== target) target.focus({ preventScroll: true });
    return target || document.activeElement;
  };

  const typeChar = (char) => {
    const input = ensureFocus();
    if (!input || !('value' in input)) return false;

    const info = keyInfo(char);
    const init = { ...info, which: info.keyCode, bubbles: true, cancelable: true, composed: true };

    
    const kd = input.dispatchEvent(new KeyboardEvent('keydown', init));
    const kp = kd && input.dispatchEvent(new KeyboardEvent('keypress', { ...init, charCode: info.keyCode }));

    if (kd && kp) {
      const value = input.value ?? '';
      const start = input.selectionStart ?? value.length;
      const end   = input.selectionEnd   ?? start;
      setValue(input, value.slice(0, start) + char + value.slice(end));
      try { input.setSelectionRange(start + 1, start + 1); } catch {}
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: char
      }));
    }
    input.dispatchEvent(new KeyboardEvent('keyup', init));
    stats.chars++;
    return true;
  };

  const typeBackspace = () => {
    const input = ensureFocus();
    if (!input || !('value' in input)) return;
    const init = { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true, composed: true };
    const kd = input.dispatchEvent(new KeyboardEvent('keydown', init));
    if (kd) {
      const value = input.value ?? '';
      const start = input.selectionStart ?? value.length;
      const end   = input.selectionEnd   ?? start;
      const from  = start === end ? Math.max(0, start - 1) : start;
      setValue(input, value.slice(0, from) + value.slice(end));
      try { input.setSelectionRange(from, from); } catch {}
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'deleteContentBackward', data: null
      }));
    }
    input.dispatchEvent(new KeyboardEvent('keyup', init));
  };

  
  const NEIGHBOURS = {
    a:'qswy', b:'vghn', c:'xdfv', d:'serfcx', e:'wsdr', f:'drtgvc', g:'ftzhbv',
    h:'gzujnb', i:'ujko', j:'huiknm', k:'jiolm', l:'koep', m:'njk', n:'bhjm',
    o:'iklp', p:'olue', q:'wa', r:'edft', s:'awedxy', t:'rfgz', u:'zhji',
    v:'cfgb', w:'qase', x:'ysdc', y:'axs', z:'tghu',
    '1':'2q','2':'13w','3':'24e','4':'35r','5':'46t','6':'57z','7':'68u','8':'79i','9':'80o','0':'9p'
  };
  const typoFor = (char) => {
    const low = char.toLowerCase();
    const pool = NEIGHBOURS[low];
    if (!pool) return null;
    let wrong = pool[Math.floor(Math.random() * pool.length)];
    if (char === char.toUpperCase() && /[a-z]/i.test(char)) wrong = wrong.toUpperCase();
    return wrong;
  };

  const delayNow = () => {
    const base = 60000 / Math.max(1, cfg.kpm);
    return base < 4 ? base : base * (0.75 + Math.random() * 0.5); 
  };

  
  
  let lastYield = 0;
  const pace = async (factor = 1) => {
    const d = delayNow() * factor;
    if (d >= 4) {
      await sleep(d);
      lastYield = performance.now();
    } else if (performance.now() - lastYield > 8) {
      await sleep(0);
      lastYield = performance.now();
    }
  };

  

  const stats = { chars: 0, errors: 0 };
  let sampleChars = 0, sampleTime = performance.now(), measured = 0;

  const liveKpm = () => {
    const now = performance.now();
    const span = now - sampleTime;
    if (span >= 400) {
      measured = Math.round((stats.chars - sampleChars) / (span / 60000));
      sampleChars = stats.chars;
      sampleTime = now;
    }
    return measured;
  };

  

  let stuck = 0;
  let looping = false;

  async function run() {
    if (looping) return;
    looping = true;
    try {
      while (cfg.running && !cfg.manual) {
        const el = document.querySelector(SELECTOR);
        if (!el) { setStatus('Element not found', true); stop(); return; }

        const text = (el.textContent || '').replace(/\u00A0/g, ' ');
        if (!text.length) { await sleep(50); continue; }

        for (const char of text) {
          if (!cfg.running || cfg.manual) return;

          
          if (Math.random() * 100 < cfg.errorRate) {
            const wrong = typoFor(char);
            if (wrong) {
              typeChar(wrong);
              stats.errors++;
              await pace(1.5);
              if (cfg.correct) {
                typeBackspace();
                await pace();
              }
            }
          }

          typeChar(char);
          await pace();
        }

        const next = document.querySelector(SELECTOR);
        if (next && (next.textContent || '').replace(/\u00A0/g, ' ') === text) {
          if (++stuck > 25) { setStatus('Stuck at ' + JSON.stringify(text), true); stop(); return; }
        } else stuck = 0;
      }
    } finally { looping = false; }
  }

  

  let binding = false;   

  const hotkeyLabel = (hk) => {
    const parts = [];
    if (hk.ctrl)  parts.push('Ctrl');
    if (hk.shift) parts.push('Shift');
    if (hk.alt)   parts.push('Alt');
    parts.push(hk.key.length === 1 ? hk.key.toUpperCase() : hk.key);
    return parts.join('+');
  };

  const normKey = k => k.length === 1 ? k.toLowerCase() : k;

  const matchHotkey = (e, hk) =>
    normKey(e.key || '') === normKey(hk.key) &&
    !!e.ctrlKey === !!hk.ctrl && !!e.shiftKey === !!hk.shift && !!e.altKey === !!hk.alt;

  
  

  let buffer = '';          
  let queue = [];           

  const peekChar = () => {
    if (!buffer.length) {
      const el = document.querySelector(SELECTOR);
      buffer = (el ? el.textContent || '' : '').replace(/\u00A0/g, ' ');
    }
    return buffer[0];
  };

  const nextAction = () => {
    if (!queue.length) {
      queue = Math.random() * 100 < cfg.errorRate
        ? (cfg.correct ? ['typo', 'back', 'char'] : ['typo', 'char'])
        : ['char'];
    }
    return queue.shift();
  };

  function step() {
    const action = nextAction();

    if (action === 'back') { typeBackspace(); return; }

    const char = peekChar();
    if (char === undefined) { setStatus('no character in element', true); return; }

    if (action === 'typo') {
      const wrong = typoFor(char);
      if (wrong) { typeChar(wrong); stats.errors++; return; }
      queue.length = 0; 
    }

    typeChar(char);
    buffer = buffer.slice(1);
  }

  
  
  const swallow = (e) => {
    if (!cfg.running || !cfg.manual || !e.isTrusted) return;
    if (binding || matchHotkey(e, cfg.hotkey)) return;   
    if (e.ctrlKey || e.metaKey || e.altKey) return;      
    if (e.key && e.key.length !== 1 && e.key !== 'Enter') return; 
    const input = target || document.activeElement;
    if (e.target !== input) return;                      

    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'keydown') step();
  };
  ['keydown', 'keypress', 'keyup'].forEach(t => document.addEventListener(t, swallow, true));

  

  const style = document.createElement('style');
  style.textContent = `
    #at-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:250px;
      background:#1c1f26;color:#e7e9ee;border:1px solid #333947;border-radius:10px;
      box-shadow:0 8px 28px rgba(0,0,0,.45);font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;
      padding:12px 13px 11px;user-select:none}
    #at-panel *{box-sizing:border-box;font-family:inherit}
    #at-panel .at-head{display:flex;justify-content:space-between;align-items:center;
      font-weight:600;margin-bottom:10px;letter-spacing:.2px}
    #at-panel .at-x{cursor:pointer;opacity:.5;font-size:17px;line-height:1;padding:0 3px}
    #at-panel .at-x:hover{opacity:1}
    #at-panel .at-btns{display:flex;gap:2px;align-items:center}
    #at-panel .at-min{cursor:pointer;opacity:.5;font-size:17px;line-height:1;padding:0 4px}
    #at-panel .at-min:hover{opacity:1}
    #at-panel.at-hidden{display:none}
    #at-panel .at-row{display:flex;align-items:center;gap:7px;margin-top:11px;font-size:11.5px;color:#98a0b3}
    #at-panel .at-row b{color:#7dd3a0;font-weight:600;margin-left:auto}
    #at-panel .at-bind{cursor:pointer;color:#7d93c4;text-decoration:underline;text-underline-offset:2px}
    #at-panel .at-bind:hover{color:#a8bdea}
    #at-panel label{display:flex;justify-content:space-between;font-size:11.5px;
      text-transform:uppercase;letter-spacing:.4px;color:#98a0b3;margin:9px 0 3px}
    #at-panel label b{color:#7dd3a0;font-weight:600;text-transform:none;letter-spacing:0}
    #at-panel input[type=range]{width:100%;margin:0;accent-color:#4c8bf5;height:16px;cursor:pointer}
    #at-panel .at-check{display:flex;align-items:center;gap:7px;margin:11px 0 2px;
      font-size:12px;color:#c3c9d6;text-transform:none;letter-spacing:0;cursor:pointer}
    #at-panel .at-check input{accent-color:#4c8bf5;margin:0;cursor:pointer}
    #at-panel button{width:100%;margin-top:11px;padding:8px;border:0;border-radius:7px;
      background:#3d7a4e;color:#fff;font-weight:600;font-size:13px;cursor:pointer}
    #at-panel button:hover{filter:brightness(1.12)}
    #at-panel button.at-on{background:#8c3b3b}
    #at-panel .at-stats{margin-top:9px;font-size:11.5px;color:#8b93a7;
      display:flex;justify-content:space-between;font-variant-numeric:tabular-nums}
    #at-panel .at-status{margin-top:6px;font-size:11px;color:#8b93a7;min-height:14px}
    #at-panel .at-status.at-err{color:#e07a7a}
    #at-panel #at-speed.at-off{opacity:.32;pointer-events:none}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'at-panel';
  panel.innerHTML = `
    <div class="at-head"><span>⌨️ Auto-Typer</span><span class="at-btns"><span class="at-min" title="Hide">–</span><span class="at-x" title="Close">×</span></span></div>
    <div id="at-speed">
      <label>Speed <b id="at-kpm-v"></b></label>
      <input type="range" id="at-kpm" min="0" max="1000" step="1">
    </div>
    <label>Error rate <b id="at-err-v"></b></label>
    <input type="range" id="at-err" min="0" max="25" step="0.5">
    <label class="at-check"><input type="checkbox" id="at-fix"> Correct errors with backspace</label>
    <label class="at-check"><input type="checkbox" id="at-manual"> Ghost mode (your own keystrokes trigger typing)</label>
    <div class="at-row"><span>Show/hide with</span><b id="at-key"></b><span class="at-bind" id="at-bind">change</span></div>
    <button id="at-go">▶ Start</button>
    <div class="at-stats"><span id="at-s1">0 chars</span><span id="at-s2">0 errors</span><span id="at-s3">0 CPM</span></div>
    <div class="at-status" id="at-status"></div>
  `;
  document.body.appendChild(panel);

  const $ = id => panel.querySelector('#' + id);
  const btn = $('at-go');
  const statusEl = $('at-status');
  const setStatus = (msg, err) => { statusEl.textContent = msg || ''; statusEl.classList.toggle('at-err', !!err); };

  
  $('at-kpm').value = kpmToPos(cfg.kpm);
  $('at-err').value = cfg.errorRate;
  $('at-fix').checked = cfg.correct;
  $('at-manual').checked = cfg.manual;
  $('at-kpm-v').textContent = fmtKpm(cfg.kpm) + ' CPM';
  $('at-err-v').textContent = cfg.errorRate + ' %';
  $('at-speed').classList.toggle('at-off', cfg.manual);

  
  $('at-kpm').addEventListener('input', e => {
    cfg.kpm = posToKpm(+e.target.value);
    $('at-kpm-v').textContent = fmtKpm(cfg.kpm) + ' CPM';
  });
  $('at-err').addEventListener('input', e => {
    cfg.errorRate = +e.target.value;
    $('at-err-v').textContent = cfg.errorRate + ' %';
  });
  $('at-fix').addEventListener('change', e => { cfg.correct = e.target.checked; queue.length = 0; save(); });

  $('at-manual').addEventListener('change', e => {
    cfg.manual = e.target.checked;
    queue.length = 0;
    buffer = '';
    $('at-speed').classList.toggle('at-off', cfg.manual);
    save();
    if (cfg.running) {
      setStatus(cfg.manual ? 'Ghost mode: just start typing' : 'running …');
      if (!cfg.manual) run();   
    }
  });

  
  $('at-kpm').addEventListener('change', save);
  $('at-err').addEventListener('change', save);

  
  panel.addEventListener('pointerup', () => setTimeout(ensureFocus, 0));

  function start() {
    if (!target) target = document.activeElement;
    if (!target || !('value' in target) || panel.contains(target)) {
      setStatus('Click into the page\'s text field first!', true);
      return;
    }
    stuck = 0;
    queue.length = 0;
    buffer = '';
    cfg.running = true;
    btn.textContent = '■ Stop';
    btn.classList.add('at-on');
    ensureFocus();
    if (cfg.manual) {
      setStatus('Ghost mode: just start typing');
    } else {
      setStatus('running …');
      run();
    }
  }

  function stop() {
    cfg.running = false;
    btn.textContent = '▶ Start';
    btn.classList.remove('at-on');
    if (!statusEl.classList.contains('at-err')) setStatus('stopped');
  }

  btn.addEventListener('click', () => cfg.running ? stop() : start());
  panel.querySelector('.at-x').addEventListener('click', () => window.__autotyper.destroy());

  
  

  const setHidden = (hide) => {
    cfg.hidden = hide;
    panel.classList.toggle('at-hidden', hide);
    save();
    ensureFocus();
  };

  panel.querySelector('.at-min').addEventListener('click', () => setHidden(true));

  const keyEl = $('at-key');
  keyEl.textContent = hotkeyLabel(cfg.hotkey);

  $('at-bind').addEventListener('click', () => {
    binding = true;
    keyEl.textContent = 'Press a key …';
    setStatus('Esc cancels');
  });

  const hotkey = (e) => {
    
    if (binding) {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return; 
      e.preventDefault();
      e.stopImmediatePropagation();
      binding = false;
      if (e.key !== 'Escape') {
        cfg.hotkey = { key: normKey(e.key), ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey };
        save();
        setStatus(cfg.hotkey.key.length === 1 && !cfg.hotkey.ctrl && !cfg.hotkey.alt
          ? 'Warning: key without modifier'
          : '');
      } else setStatus('');
      keyEl.textContent = hotkeyLabel(cfg.hotkey);
      ensureFocus();
      return;
    }

    if (matchHotkey(e, cfg.hotkey)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setHidden(!cfg.hidden);
    }
  };
  document.addEventListener('keydown', hotkey, true);

  if (cfg.hidden) panel.classList.add('at-hidden');

  const ticker = setInterval(() => {
    $('at-s1').textContent = stats.chars + ' chars';
    $('at-s2').textContent = stats.errors + ' errors';
    $('at-s3').textContent = (cfg.running ? liveKpm() : 0) + ' CPM';
  }, 250);

  window.__autotyper = {
    cfg, stats, start, stop,
    hide: () => setHidden(true),
    show: () => setHidden(false),
    toggle: () => setHidden(!cfg.hidden),
    destroy() {
      cfg.running = false;
      clearInterval(ticker);
      document.removeEventListener('focusin', focusHandler, true);
      ['keydown', 'keypress', 'keyup'].forEach(t => document.removeEventListener(t, swallow, true));
      document.removeEventListener('keydown', hotkey, true);
      panel.remove();
      style.remove();
      delete window.__autotyper;
    }
  };

  setStatus('Click into the text field, then Start.');
})();

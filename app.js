// BPM Atelier — logique principale (aucune dépendance)
(() => {
  const $ = id => document.getElementById(id);
  let lang = localStorage.getItem('bpm-lang') || (navigator.language||'fr').slice(0,2);
  if (!I18N[lang]) lang = 'fr';
  let bpm = 120, taps = [], metroTimer = null, audio = null;
  const t = k => I18N[lang][k] ?? k;

  /* ---------- Langue ---------- */
  function applyLang(){
    document.documentElement.lang = lang === 'kab' ? 'kab' : lang;
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    $('kabNote').hidden = lang !== 'kab';
    $('metro').textContent = metroTimer ? t('metroOff') : t('metroOn');
    $('lang').value = lang; render();
  }
  $('lang').onchange = e => { lang = e.target.value; localStorage.setItem('bpm-lang', lang); applyLang(); };

  /* ---------- Tap tempo : moyenne des 8 derniers intervalles ---------- */
  function tap(){
    const now = performance.now();
    if (taps.length && now - taps[taps.length-1] > 2000) taps = []; // pause > 2 s = nouveau départ
    taps.push(now); if (taps.length > 9) taps.shift();
    if (taps.length > 1) setBpm(60000 * (taps.length-1) / (now - taps[0]));
    const b = $('tap'); b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 80);
  }
  $('tap').onclick = tap;
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !/INPUT|SELECT/.test(e.target.tagName)) { e.preventDefault(); tap(); }
  });

  function setBpm(v){
    if (!isFinite(v)) return;
    bpm = Math.min(300, Math.max(20, Math.round(v*10)/10));
    $('bpm').value = bpm; render(); if (metroTimer) startMetro();
  }
  $('bpm').oninput = e => { const v = parseFloat(e.target.value); if (v>=20 && v<=300){ bpm=v; render(); if(metroTimer) startMetro(); } };
  $('half').onclick = () => setBpm(bpm/2);
  $('dbl').onclick = () => setBpm(bpm*2);
  $('reset').onclick = () => { taps = []; setBpm(120); };

  /* ---------- Métronome (Web Audio, bip court) ---------- */
  function click(accent){
    audio = audio || new (window.AudioContext||window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(.3, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime+.05);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime+.06);
  }
  function startMetro(){
    clearInterval(metroTimer); let n = 0;
    metroTimer = setInterval(() => click(n++ % 4 === 0), 60000/bpm);
  }
  $('metro').onclick = () => {
    if (metroTimer){ clearInterval(metroTimer); metroTimer = null; } else startMetro();
    $('metro').textContent = metroTimer ? t('metroOff') : t('metroOn');
  };

  /* ---------- Rendu : délais + coupes vidéo ---------- */
  const NOTES = [['1/1',4],['1/2',2],['1/4',1],['1/8',.5],['1/16',.25],['1/32',.125]];
  const fmt = ms => ms >= 100 ? ms.toFixed(1) : ms.toFixed(2);

  // Timecode SMPTE HH:MM:SS:FF (non drop-frame)
  function tc(sec, fps){
    const r = Math.round(fps), fr = Math.round(sec*fps);
    const ff = fr % r, s = Math.floor(fr / r);
    const p = n => String(n).padStart(2,'0');
    return `${p(Math.floor(s/3600))}:${p(Math.floor(s/60)%60)}:${p(s%60)}:${p(ff)}`;
  }
  function cuts(){
    const fps = parseFloat($('fps').value), every = +$('every').value;
    const n = Math.min(200, Math.max(1, +$('count').value||16));
    return Array.from({length:n}, (_,i) => { const s = i*every*60/bpm; return {i:i+1, s, tc:tc(s,fps), frame:Math.round(s*fps)}; });
  }
  function render(){
    $('bpmBig').textContent = bpm % 1 ? bpm.toFixed(1) : bpm;
    const q = 60000/bpm;
    $('delays').tBodies[0].innerHTML = NOTES.map(([n,m]) => {
      const v = [q*m, q*m*1.5, q*m*2/3];
      return `<tr><td>${n}</td>${v.map(x=>`<td class="c">${fmt(x)}</td>`).join('')}<td>${(1000/(q*m)).toFixed(2)}</td></tr>`;
    }).join('');
    const fps = parseFloat($('fps').value);
    $('frameInfo').textContent = t('frames').replace('{f}', (q/1000*fps).toFixed(2)).replace('{fps}', fps).replace('{ms}', q.toFixed(1));
    $('cuts').innerHTML = cuts().map(c => `<li>${c.tc} <span style="color:var(--mute)">(${c.s.toFixed(3)} s · f${c.frame})</span></li>`).join('');
  }
  ['fps','every','count'].forEach(id => $(id).oninput = render);

  /* ---------- Copie / export ---------- */
  function toast(){ const el=$('toast'); el.textContent=t('copied'); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }
  function copy(txt){ (navigator.clipboard?.writeText(txt) || Promise.reject()).then(toast, () => { const a=document.createElement('textarea'); a.value=txt; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); toast(); }); }
  $('delays').onclick = e => { if (e.target.classList.contains('c')) copy(e.target.textContent); };
  $('copyCuts').onclick = () => copy(cuts().map(c=>c.tc).join('\n'));
  $('dlCsv').onclick = () => {
    const csv = 'Marker,Timecode,Seconds,Frame\n' + cuts().map(c=>`Cut ${c.i},${c.tc},${c.s.toFixed(3)},${c.frame}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `cuts-${bpm}bpm.csv`; a.click();
  };

  applyLang();
})();

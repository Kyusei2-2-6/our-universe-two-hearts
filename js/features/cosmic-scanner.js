/* Cosmic Scanner: animasi "pemindaian" singkat yang tampil setelah tombol MASUK ditekan,
   sebelum masuk ke website. Murni tampilan (tidak menyentuh Supabase). Bisa dilewati kapan saja. */

const LINES=[
  'INITIALIZING COSMIC SYSTEM...',
  'CONNECTING TO TWO HEARTS...',
  'SCANNING UNIVERSE...',
  'CONNECTION ESTABLISHED.'
];
const TYPE_MS=22,LINE_PAUSE=260,HOLD_MS=520,REDUCED_HOLD_MS=700;

let cssPromise=null;
function ensureStyles(){
  if(cssPromise)return cssPromise;
  cssPromise=new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href=new URL('../../css/cosmic-scanner.css?v=4.9.12',import.meta.url).href;
    link.onload=()=>resolve();link.onerror=()=>resolve();
    document.head.append(link);setTimeout(resolve,1500);
  });
  return cssPromise;
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}

/* Menjalankan animasi scanner lalu mengembalikan promise yang selesai saat animasi berakhir (atau dilewati).
   onDone HARUS dipanggil oleh pemanggil untuk melanjutkan alur (membuka website). */
export async function runCosmicScanner(){
  await ensureStyles();
  const reduced=reducedMotion();
  const overlay=el('div','cosmic-scanner');overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.setAttribute('data-capture-ignore','true');
  overlay.innerHTML=`
    <div class="cosmic-scanner__field" aria-hidden="true"></div>
    <div class="cosmic-scanner__radar" aria-hidden="true"><div class="cosmic-scanner__sweep"></div><div class="cosmic-scanner__ring"></div><div class="cosmic-scanner__ring cosmic-scanner__ring--2"></div></div>
    <div class="cosmic-scanner__panel">
      <pre class="cosmic-scanner__terminal" data-terminal></pre>
      <button type="button" class="cosmic-scanner__skip" data-skip>Lewati</button>
    </div>`;
  document.body.append(overlay);
  requestAnimationFrame(()=>overlay.classList.add('is-visible'));

  let skipped=false;
  const finish=()=>new Promise(resolve=>{
    overlay.classList.add('is-leaving');
    overlay.classList.remove('is-visible');
    const done=()=>{overlay.remove();resolve();};
    overlay.addEventListener('transitionend',done,{once:true});
    setTimeout(done,500); // jaring pengaman jika transisi tidak sempat terpicu (mis. tab tersembunyi)
  });

  overlay.querySelector('[data-skip]').onclick=()=>{skipped=true;};

  const terminal=overlay.querySelector('[data-terminal]');
  if(reduced){
    terminal.textContent=LINES.join('\n');
    await sleep(REDUCED_HOLD_MS);
  }else{
    for(const line of LINES){
      if(skipped)break;
      const row=document.createElement('div');terminal.append(row);
      for(const ch of line){
        if(skipped)break;
        row.textContent+=ch;
        await sleep(TYPE_MS);
      }
      if(!skipped)row.textContent=line; // pastikan baris utuh walau skip terjadi di tengah karakter
      await sleep(skipped?0:LINE_PAUSE);
    }
    if(!skipped)await sleep(HOLD_MS);
  }
  await finish();
}

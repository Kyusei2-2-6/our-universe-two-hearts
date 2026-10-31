/* Pertanyaan Hari Ini untuk dua orang (Couple Connect).
   Jawaban disimpan sebagai baris pesan (kind=text, metadata.feature='qotd') di tabel couple_messages
   yang sudah ada, dan disembunyikan dari chat biasa. Tanpa perubahan database. */

export const QUESTIONS=[
'Momen kecil apa dari hari ini yang bikin kamu tersenyum?',
'Apa hal pertama yang kamu perhatikan dariku waktu kita mulai dekat?',
'Lagu apa yang paling mengingatkanmu padaku, dan kenapa?',
'Kalau kita punya satu hari bebas tanpa rencana, kamu ingin kita ngapain?',
'Kebiasaan kecilku apa yang diam-diam kamu suka?',
'Tempat mana yang ingin kamu kunjungi bersamaku suatu hari nanti?',
'Kapan kamu merasa paling dicintai?',
'Kenangan kita yang paling sering kamu putar ulang di kepala?',
'Makanan apa yang ingin kamu makan atau masak bareng aku?',
'Apa satu hal yang ingin kamu ucapkan padaku tapi belum sempat?',
'Kalau perjalanan kita ini sebuah film, apa judulnya?',
'Apa yang kamu pelajari tentang dirimu sendiri sejak mengenalku?',
'Hal kecil apa yang bisa kulakukan supaya harimu terasa lebih ringan?',
'Mimpi apa yang ingin kamu capai dalam setahun ke depan?',
'Kapan terakhir kali kamu tertawa sampai sakit perut, dan karena apa?',
'Warna apa yang menggambarkan perasaanmu hari ini?',
'Sebutkan tiga hal yang kamu syukuri minggu ini.',
'Kalau bisa kembali ke satu hari bersamaku, kamu pilih hari yang mana?',
'Apa yang paling kamu tunggu-tunggu dari hubungan kita?',
'Apa hal yang bikin kamu merasa tenang saat bersamaku?',
'Kalau aku jadi karakter dongeng, kira-kira aku siapa?',
'Apa yang ingin kamu ingat dari tahun ini suatu hari nanti?',
'Hal apa yang ingin kamu coba untuk pertama kalinya bersamaku?',
'Apa pesan yang ingin kamu titipkan untuk dirimu sendiri sepuluh tahun lagi?',
'Apa rutinitas pagi yang paling bikin kamu semangat?',
'Kata apa yang paling pas menggambarkan kita?',
'Apa yang membuatmu bangga pada dirimu minggu ini?',
'Film atau series apa yang ingin kamu tonton bareng aku?',
'Apa yang biasanya kamu lakukan saat sedang kangen?',
'Kalau kita bisa tinggal di mana saja, kamu ingin di mana?',
'Apa satu kebaikan kecil dariku yang masih kamu ingat?',
'Apa hal yang kamu harap lebih sering kita lakukan berdua?',
'Bagaimana caramu paling suka diberi semangat saat lelah?',
'Apa hal paling lucu yang pernah kita alami bersama?',
'Apa yang kamu rasakan saat pertama kali kita ngobrol lama?',
'Kalau punya satu keajaiban kecil untuk kita berdua, apa itu?',
'Apa ketakutan kecil yang ingin kamu ceritakan padaku?',
'Sebutkan satu hal yang kamu kagumi dari caraku menjalani hidup.',
'Apa yang ingin kamu lakukan di ulang tahun kita nanti?',
'Hobi baru apa yang ingin kita pelajari bersama?',
'Apa yang membuat kamu merasa dimengerti?',
'Kalau hari ini punya warna langit, langit seperti apa?',
'Apa yang paling kamu syukuri dari hubungan kita?',
'Apa hal sederhana yang selalu bikin harimu membaik?',
'Kalau kita menulis surat untuk diri kita setahun lagi, kamu mau bilang apa?',
'Apa tempat paling nyaman di dunia menurutmu?',
'Hal apa dari masa kecilmu yang ingin kamu ceritakan padaku?',
'Apa satu janji kecil yang ingin kamu buat untuk kita?',
'Momen apa yang membuatmu yakin kita cocok?',
'Apa yang ingin kamu dengar dariku hari ini?',
'Kalau kita punya hewan peliharaan bareng, apa dan siapa namanya?',
'Apa hal yang membuatmu rindu rumah?',
'Apa yang paling kamu nikmati dari obrolan kita?',
'Kalau kamu menulis satu baris di buku harian kita, apa isinya?',
'Apa hal baik yang ingin kamu lihat terjadi minggu depan?',
'Apa yang membuatmu merasa aman?',
'Apa hal yang ingin kamu minta maaf atau terima kasihkan hari ini?',
'Bayangkan akhir pekan sempurna kita. Seperti apa?',
'Apa satu kata semangat yang ingin kamu dengar saat sedang berat?',
'Apa yang membuatmu jatuh hati pada hal-hal kecil di hubungan ini?'
];

const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
export const MAX_ANSWER=500;

export function dayKey(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function dayNumber(key){const[y,m,d]=key.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);}
export function shiftDay(key,delta){const t=new Date((dayNumber(key)+delta)*86400000);return t.toISOString().slice(0,10);}
export function questionFor(key){return QUESTIONS[((dayNumber(key)%QUESTIONS.length)+QUESTIONS.length)%QUESTIONS.length];}
export function formatDay(key){
  const[y,m,d]=key.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(Date.UTC(y,m-1,d)));
}

export function isQuestionRow(row){
  const meta=row?.metadata;
  return Boolean(meta&&meta.feature==='qotd'&&meta.type==='answer');
}

function compareRows(a,b){
  const left=String(a.created_at||''),right=String(b.created_at||'');
  if(left!==right)return left<right?-1:1;
  return String(a.id||'')<String(b.id||'')?-1:String(a.id||'')>String(b.id||'')?1:0;
}

/* Murni: baris -> { 'YYYY-MM-DD': {question, answers:{userId:{text,at,id}}} }.
   Hanya jawaban PERTAMA setiap orang untuk setiap hari yang dihitung. */
export function buildDays(rows){
  const days={};
  for(const row of[...rows].filter(isQuestionRow).sort(compareRows)){
    const meta=row.metadata,date=meta.date,text=typeof meta.answer==='string'?meta.answer.trim():'';
    if(!DATE_RE.test(String(date))||!text||text.length>MAX_ANSWER||!row.sender_id)continue;
    const day=days[date]||(days[date]={question:'',answers:{}});
    if(day.answers[row.sender_id])continue;
    day.answers[row.sender_id]={text,at:row.created_at||null,id:row.id||null};
    if(!day.question)day.question=typeof meta.question==='string'&&meta.question?meta.question.slice(0,240):questionFor(date);
  }
  return days;
}

export function bothAnswered(day,ids){return Boolean(day&&ids.length===2&&ids.every(id=>day.answers[id]));}

/* Berapa hari berturut-turut kalian berdua menjawab. Hari ini yang belum lengkap tidak memutus rangkaian. */
export function computeStreak(days,today,ids){
  let count=0,key=bothAnswered(days[today],ids)?today:shiftDay(today,-1);
  while(bothAnswered(days[key],ids)){count++;key=shiftDay(key,-1);}
  return count;
}

/* ---------------- Tampilan ---------------- */
let cssPromise=null;
function ensureStyles(){
  if(cssPromise)return cssPromise;
  cssPromise=new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href=new URL('../../css/daily-question.css?v=4.9.9',import.meta.url).href;
    link.onload=()=>resolve();link.onerror=()=>resolve();
    document.head.append(link);setTimeout(resolve,1800);
  });
  return cssPromise;
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
const DRAFT_PREFIX='ou:qotd-draft:';
function readDraft(key){try{return localStorage.getItem(DRAFT_PREFIX+key)||'';}catch{return '';}}
function writeDraft(key,value){try{if(value)localStorage.setItem(DRAFT_PREFIX+key,value);else localStorage.removeItem(DRAFT_PREFIX+key);}catch{}}

export function createDailyQuestion({getContext,load,send,toast=()=>{},onChange,now=()=>new Date()}){
  let rows=[],ids=new Set(),days={},root=null,els=null,opened=false,busy=false,escapeBound=false,shown=14;
  const me=()=>getContext();
  const today=()=>dayKey(now());
  const players=()=>{const ctx=me();return[ctx.userId,ctx.partnerId].filter(Boolean);};

  function recompute(){days=buildDays(rows);}
  function ingest(input){
    let added=false;
    for(const row of Array.isArray(input)?input:[input]){
      if(!row||!isQuestionRow(row)||ids.has(row.id))continue;
      ids.add(row.id);rows.push(row);added=true;
    }
    if(!added)return;
    recompute();
    if(opened)render();
    onChange?.();
  }
  function reset(){rows=[];ids=new Set();days={};busy=false;close();onChange?.();}
  const needsMyAnswer=()=>{const ctx=me();return Boolean(ctx.userId&&ctx.partnerId&&!days[today()]?.answers[ctx.userId]);};
  const partnerAnsweredToday=()=>{const ctx=me();return Boolean(days[today()]?.answers[ctx.partnerId]);};

  function nameOf(id){const ctx=me();return id===ctx.userId?'Kamu':(ctx.partnerName||'Pasanganmu');}

  function buildUI(){
    root=el('section','dq-overlay');root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Pertanyaan hari ini');root.setAttribute('data-capture-ignore','true');
    const head=el('header','dq-head');
    const title=el('div','dq-title');title.append(el('h2','','💭 Pertanyaan Hari Ini'));const date=el('small','');title.append(date);
    const close=el('button','icon-button dq-close','×');close.type='button';close.setAttribute('aria-label','Tutup');close.onclick=()=>closeUI();
    head.append(title,close);
    const main=el('div','dq-main');
    const streak=el('div','dq-streak');streak.hidden=true;
    const card=el('article','dq-card');const q=el('p','dq-question');card.append(el('span','dq-eyebrow','Untuk kita berdua'),q);
    const form=el('form','dq-form');
    const area=el('textarea','dq-input');area.maxLength=MAX_ANSWER;area.rows=4;area.placeholder='Tulis jawabanmu dengan jujur…';area.setAttribute('aria-label','Jawabanmu');
    const row=el('div','dq-form-row');const count=el('small','dq-count','0/'+MAX_ANSWER);
    const submit=el('button','button button--primary dq-submit','Kirim jawaban');submit.type='submit';row.append(count,submit);form.append(area,row);
    const answers=el('div','dq-answers');
    const historyHead=el('h3','dq-history-title','Hari-hari sebelumnya');
    const history=el('div','dq-history');
    const more=el('button','button button--ghost dq-more','Lihat lebih banyak');more.type='button';
    main.append(streak,card,form,answers,historyHead,history,more);root.append(head,main);
    area.addEventListener('input',()=>{count.textContent=`${area.value.length}/${MAX_ANSWER}`;writeDraft(today(),area.value);});
    form.onsubmit=event=>{event.preventDefault();submitAnswer();};
    more.onclick=()=>{shown+=14;render();};
    els={date,streak,q,form,area,submit,count,answers,historyHead,history,more};
    document.body.append(root);
    if(!escapeBound){document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.stopPropagation();closeUI();}},true);escapeBound=true;}
  }

  function answerCard(label,text,mine){
    const card=el('div',`dq-answer${mine?' is-mine':''}`);card.append(el('small','',label),el('p','',text));return card;
  }

  function render(){
    if(!root)return;
    const ctx=me(),key=today(),day=days[key],myAnswer=day?.answers[ctx.userId],theirAnswer=day?.answers[ctx.partnerId];
    els.date.textContent=formatDay(key);
    els.q.textContent=questionFor(key);
    const streak=computeStreak(days,key,players());
    els.streak.hidden=streak<1;els.streak.textContent=`🔥 ${streak} hari berturut-turut menjawab bersama`;
    els.form.hidden=Boolean(myAnswer);
    els.submit.disabled=busy;els.area.disabled=busy;
    els.answers.replaceChildren();
    if(myAnswer){
      els.answers.append(answerCard('Jawabanmu',myAnswer.text,true));
      if(theirAnswer)els.answers.append(answerCard(`Jawaban ${ctx.partnerName||'pasanganmu'}`,theirAnswer.text,false));
      else{const wait=el('div','dq-wait','⏳ Dia belum menjawab. Kamu akan dapat pemberitahuan saat dia menjawab.');els.answers.append(wait);}
    }else if(theirAnswer){
      els.answers.append(el('div','dq-lock','🔒 Dia sudah menjawab! Tulis jawabanmu dulu untuk membukanya.'));
    }
    const past=Object.keys(days).filter(k=>k<key).sort().reverse();
    const mineAnswered=k=>Boolean(days[k].answers[ctx.userId]);
    els.history.replaceChildren(...past.slice(0,shown).map(k=>{
      const d=days[k],item=el('article','dq-past');
      item.append(el('small','dq-past-date',formatDay(k)),el('p','dq-past-q',d.question||questionFor(k)));
      const mine=d.answers[ctx.userId],theirs=d.answers[ctx.partnerId];
      if(mine)item.append(answerCard('Kamu',mine.text,true));
      if(theirs){
        if(mineAnswered(k))item.append(answerCard(ctx.partnerName||'Pasanganmu',theirs.text,false));
        else item.append(el('div','dq-lock','🔒 Dia menjawab hari itu. Kamu belum, jadi jawabannya tetap terkunci.'));
      }
      if(!mine&&!theirs)item.append(el('div','dq-wait','Belum ada yang menjawab.'));
      return item;
    }));
    els.historyHead.hidden=past.length===0;els.more.hidden=past.length<=shown;
  }

  async function submitAnswer(){
    if(busy)return;
    const ctx=me(),key=today(),text=els.area.value.trim();
    if(!ctx.partnerId)return;
    if(days[key]?.answers[ctx.userId])return;
    if(!text){toast('Tulis jawabanmu dulu.',{type:'error'});return;}
    busy=true;render();
    const body=partnerAnsweredToday()?'💭 Pertanyaan hari ini: jawaban kita sudah terbuka, ayo lihat!':'💭 Pertanyaan hari ini: aku sudah menjawab, giliranmu!';
    try{
      const row=await send({feature:'qotd',type:'answer',date:key,question:questionFor(key),answer:text},body);
      writeDraft(key,'');els.area.value='';els.count.textContent='0/'+MAX_ANSWER;
      busy=false;ingest(row);
    }catch(error){
      toast(String(error?.message||'').match(/fetch|network/i)?'Koneksi terputus. Jawabanmu belum terkirim, tulisannya aman, coba lagi.':'Jawaban belum terkirim. Tulisannya aman, coba lagi.',{type:'error',duration:6000});
    }finally{busy=false;if(opened)render();}
  }

  async function open(){
    if(!me().partnerId){toast('Pasanganmu belum bergabung.',{type:'error'});return;}
    await ensureStyles();
    if(!root)buildUI();
    opened=true;root.hidden=false;
    const draft=readDraft(today());if(draft&&!els.area.value){els.area.value=draft;els.count.textContent=`${draft.length}/${MAX_ANSWER}`;}
    render();
    try{ingest(await load());}catch(error){console.warn('Pertanyaan hari ini belum bisa memuat jawaban:',error);}
    if(opened)render();
  }
  function closeUI(){opened=false;if(root)root.hidden=true;}
  function close(){closeUI();}

  return{open,close,reset,ingest,isOpen:()=>opened,needsMyAnswer,partnerAnsweredToday,getDays:()=>days};
}

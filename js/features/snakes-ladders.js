/* Ular Tangga untuk dua orang (Couple Connect).
   Setiap langkah disimpan sebagai satu baris pesan (kind=text, metadata.game='snakes') di tabel couple_messages
   yang sudah ada, lalu permainan dihitung ulang dari baris-baris itu. Tanpa perubahan database. */

export const LAST=100;
export const JUMPS={4:14,9:31,20:38,28:84,40:59,51:67,63:81,71:91,17:7,54:34,62:19,64:60,87:24,93:73,95:75,99:78};

export function cellPosition(n){
  const index=n-1,row=Math.floor(index/10);let col=index%10;
  if(row%2===1)col=9-col;
  return{col,row:9-row};
}

export function emptyGame(){return{gameId:null,players:[],pos:{},turn:null,seq:0,winner:null,log:[],startedBy:null,startedAt:null};}

export function isGameRow(row){
  const meta=row?.metadata;
  return Boolean(meta&&meta.game==='snakes'&&(meta.type==='start'||meta.type==='roll'));
}

function stepFor(from,roll){
  const target=from+roll;
  if(target>LAST)return{from,landed:from,to:from,kind:'over'};
  const jump=JUMPS[target];
  if(!jump)return{from,landed:target,to:target,kind:'move'};
  return{from,landed:target,to:jump,kind:jump>target?'ladder':'snake'};
}

/* Murni: menerapkan satu baris ke status permainan. Baris yang tidak sah (bukan gilirannya, urutan salah,
   ganda, setelah permainan selesai) diabaikan, sehingga hasil hitung ulang selalu sama di kedua HP. */
export function applyGameRow(state,row){
  if(!isGameRow(row))return state;
  const meta=row.metadata;
  if(meta.type==='start'){
    if(typeof meta.gameId!=='string'||!meta.gameId||!row.sender_id||!row.recipient_id||row.sender_id===row.recipient_id)return state;
    return{gameId:meta.gameId,players:[row.sender_id,row.recipient_id],pos:{[row.sender_id]:0,[row.recipient_id]:0},turn:row.sender_id,seq:0,winner:null,log:[],startedBy:row.sender_id,startedAt:row.created_at||null};
  }
  if(!state.gameId||meta.gameId!==state.gameId||state.winner||row.sender_id!==state.turn||meta.seq!==state.seq)return state;
  const roll=meta.roll;
  if(!Number.isInteger(roll)||roll<1||roll>6)return state;
  const step=stepFor(state.pos[row.sender_id]||0,roll);
  const won=step.to===LAST;
  const bonus=roll===6&&!won;
  const other=state.players.find(id=>id!==row.sender_id);
  return{
    ...state,
    pos:{...state.pos,[row.sender_id]:step.to},
    seq:state.seq+1,
    winner:won?row.sender_id:null,
    turn:won?null:(bonus?row.sender_id:other),
    log:[...state.log.slice(-29),{by:row.sender_id,roll,...step,bonus,won,id:row.id||null,at:row.created_at||null}]
  };
}

export function compareRows(a,b){
  const left=String(a.created_at||''),right=String(b.created_at||'');
  if(left!==right)return left<right?-1:1;
  return String(a.id||'')<String(b.id||'')?-1:String(a.id||'')>String(b.id||'')?1:0;
}

export function replayGame(rows){
  return[...rows].filter(isGameRow).sort(compareRows).reduce(applyGameRow,emptyGame());
}

/* Pratinjau satu lemparan tanpa menyimpannya. null jika lemparan tidak sah. */
export function previewRoll(state,userId,roll){
  const next=applyGameRow(state,{id:null,sender_id:userId,metadata:{game:'snakes',type:'roll',gameId:state.gameId,seq:state.seq,roll}});
  return next===state?null:{state:next,entry:next.log[next.log.length-1]};
}

export function randomRoll(){
  const buffer=new Uint32Array(1);
  const limit=Math.floor(0x100000000/6)*6;
  do{crypto.getRandomValues(buffer);}while(buffer[0]>=limit);
  return(buffer[0]%6)+1;
}

/* ---------------- Tampilan ---------------- */
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const SVG_NS='http://www.w3.org/2000/svg';
const SNAKE_COLORS=['#ff7eb6','#b58cff','#ff9d6c','#6cd9ff','#ff6f91','#9d8cff','#ffb36b','#7be0c3'];
let cssPromise=null;

function ensureStyles(){
  if(cssPromise)return cssPromise;
  cssPromise=new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href=new URL('../../css/snakes-ladders.css?v=4.9.8',import.meta.url).href;
    link.onload=()=>resolve();link.onerror=()=>resolve();
    document.head.append(link);setTimeout(resolve,1800);
  });
  return cssPromise;
}

function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function svg(tag,attrs){const node=document.createElementNS(SVG_NS,tag);for(const[key,value]of Object.entries(attrs||{}))node.setAttribute(key,String(value));return node;}
function center(n){const{col,row}=cellPosition(n);return{x:col*10+5,y:row*10+5};}

function drawLadder(bottom,top){
  const group=svg('g',{class:'snk-ladder'});
  const a=center(bottom),b=center(top);
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const nx=-dy/length*1.5,ny=dx/length*1.5;
  for(const sign of[-1,1])group.append(svg('line',{x1:a.x+nx*sign,y1:a.y+ny*sign,x2:b.x+nx*sign,y2:b.y+ny*sign}));
  const rungs=Math.max(2,Math.round(length/4.2));
  for(let i=1;i<rungs;i++){
    const t=i/rungs,x=a.x+dx*t,y=a.y+dy*t;
    group.append(svg('line',{x1:x-nx,y1:y-ny,x2:x+nx,y2:y+ny,class:'rung'}));
  }
  return group;
}

function drawSnake(head,tail,index){
  const group=svg('g',{class:'snk-snake'});
  const a=center(head),b=center(tail);
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const ux=dx/length,uy=dy/length,px=-uy,py=ux,amp=Math.min(9,length*.24);
  const color=SNAKE_COLORS[index%SNAKE_COLORS.length];
  const d=`M ${a.x} ${a.y} C ${a.x+ux*length/3+px*amp} ${a.y+uy*length/3+py*amp}, ${a.x+ux*length*2/3-px*amp} ${a.y+uy*length*2/3-py*amp}, ${b.x} ${b.y}`;
  group.append(svg('path',{d,stroke:color,class:'body'}));
  group.append(svg('circle',{cx:a.x,cy:a.y,r:2.5,fill:color,class:'head'}));
  group.append(svg('circle',{cx:a.x-.8,cy:a.y-.7,r:.55,class:'eye'}),svg('circle',{cx:a.x+.8,cy:a.y-.7,r:.55,class:'eye'}));
  group.append(svg('circle',{cx:b.x,cy:b.y,r:1.1,fill:color,class:'tail'}));
  return group;
}

function buildBoard(){
  const board=el('div','snk-board');
  for(let n=1;n<=100;n++){
    const{col,row}=cellPosition(n);
    const cell=el('div',`snk-cell${(col+row)%2?' is-alt':''}`);
    cell.style.gridColumn=String(col+1);cell.style.gridRow=String(row+1);
    cell.append(el('span','',String(n)));
    board.append(cell);
  }
  const lines=svg('svg',{class:'snk-lines',viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':'true'});
  let snakeIndex=0;
  for(const[from,to]of Object.entries(JUMPS)){
    const start=Number(from);
    if(to>start)lines.append(drawLadder(start,to));
  }
  for(const[from,to]of Object.entries(JUMPS)){
    const start=Number(from);
    if(to<start)lines.append(drawSnake(start,to,snakeIndex++));
  }
  board.append(lines);
  return board;
}

function buildDie(){
  const die=el('div','snk-die');die.dataset.face='1';
  for(let i=0;i<9;i++)die.append(el('i',`pip p${i}`));
  return die;
}

function setDie(die,face){die.dataset.face=String(face);}

export function createSnakesGame({getContext,load,send,toast=()=>{},onChange}){
  let rows=[],ids=new Set(),state=emptyGame(),root=null,els=null,busy=false,opened=false,escapeBound=false;

  const me=()=>getContext();
  const isMyTurn=()=>Boolean(state.turn&&state.turn===me().userId);

  function ingest(input){
    const before=state;
    let added=false;
    for(const row of Array.isArray(input)?input:[input]){
      if(!row||!isGameRow(row)||ids.has(row.id))continue;
      ids.add(row.id);rows.push(row);added=true;
    }
    if(!added)return state;
    rows.sort(compareRows);
    state=replayGame(rows);
    const fresh=state.gameId===before.gameId?state.log.slice(before.log.length):[];
    if(opened)render(fresh);
    onChange?.(state);
    return state;
  }

  function reset(){rows=[];ids=new Set();state=emptyGame();busy=false;close();onChange?.(state);}

  function nameOf(id){const ctx=me();return id===ctx.userId?'Kamu':(ctx.partnerName||'Pasanganmu');}

  function describe(entry){
    const who=nameOf(entry.by);
    let text=`${who}: 🎲 ${entry.roll}`;
    if(entry.kind==='over')text+=' (terlalu besar, tetap di petak '+entry.to+')';
    else if(entry.kind==='ladder')text+=` → petak ${entry.landed}, naik tangga ke ${entry.to} 🪜`;
    else if(entry.kind==='snake')text+=` → petak ${entry.landed}, digigit ular turun ke ${entry.to} 🐍`;
    else text+=` → petak ${entry.to}`;
    if(entry.won)text+=' 🏆';else if(entry.bonus)text+=' · dapat 6, lempar lagi!';
    return text;
  }

  function buildUI(){
    root=el('section','snk-overlay');root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Ular tangga');root.setAttribute('data-capture-ignore','true');
    const head=el('header','snk-head');
    const title=el('div','snk-title');title.append(el('h2','','🎲 Ular Tangga'));const status=el('small','');title.append(status);
    const close=el('button','icon-button snk-close','×');close.type='button';close.setAttribute('aria-label','Tutup permainan');close.onclick=()=>closeGame();
    head.append(title,close);
    const main=el('div','snk-main');
    const wrap=el('div','snk-board-wrap');const board=buildBoard();wrap.append(board);
    const tokens={};
    for(const key of['me','partner']){const token=el('div',`snk-token is-${key}`,'');board.append(token);tokens[key]=token;}
    const panel=el('div','snk-panel');
    const die=buildDie();
    const roll=el('button','button button--primary snk-roll','🎲 Lempar dadu');roll.type='button';roll.onclick=()=>rollDice();
    const controls=el('div','snk-controls');controls.append(die,roll);
    const log=el('ol','snk-log');
    const banner=el('div','snk-banner');banner.hidden=true;
    const start=el('button','button button--primary snk-start','Mulai main');start.type='button';start.onclick=()=>startGame();
    const again=el('button','button button--ghost snk-new','Game baru');again.type='button';again.onclick=()=>startGame();
    panel.append(banner,controls,log,start,again);
    main.append(wrap,panel);root.append(head,main);
    els={status,board,tokens,die,roll,log,banner,start,again,main};
    document.body.append(root);
    if(!escapeBound){
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.stopPropagation();closeGame();}},true);
      escapeBound=true;
    }
  }

  function tokenSpot(pos,slot){
    if(pos<=0)return{x:7+slot*9,y:107};
    return center(pos);
  }

  function render(fresh=[]){
    if(!root)return;
    const ctx=me(),hasGame=Boolean(state.gameId);
    const partnerId=ctx.partnerId;
    const mine=state.pos[ctx.userId]||0,theirs=state.pos[partnerId]||0;
    for(const[key,pos,name]of[['me',mine,ctx.myName||'Kamu'],['partner',theirs,ctx.partnerName||'Dia']]){
      const token=els.tokens[key];token.textContent=String(name||'?').trim().slice(0,1).toUpperCase()||'♡';
      token.hidden=!hasGame;
      const spot=tokenSpot(pos,key==='me'?0:1);
      token.style.left=`${spot.x}%`;token.style.top=`${spot.y}%`;
      token.classList.toggle('is-stacked',pos>0&&mine===theirs&&key==='partner');
      token.title=`${name}: petak ${pos||'mulai'}`;
    }
    const myTurn=isMyTurn();
    els.roll.hidden=!hasGame||Boolean(state.winner);
    els.roll.disabled=!myTurn||busy;
    els.die.hidden=!hasGame;
    els.start.hidden=hasGame;
    els.again.hidden=!hasGame||Boolean(state.winner);
    els.banner.hidden=!state.winner;
    const lastEntry=state.log[state.log.length-1];
    if(lastEntry&&!fresh.length&&!busy)setDie(els.die,lastEntry.roll);
    if(fresh.length){const entry=fresh[fresh.length-1];setDie(els.die,entry.roll);els.die.classList.remove('is-pop');void els.die.offsetWidth;els.die.classList.add('is-pop');}
    let text;
    if(!hasGame)text='Belum ada permainan. Ajak dia main!';
    else if(state.winner)text=state.winner===ctx.userId?'🏆 Kamu menang!':`🏆 ${nameOf(state.winner)} menang!`;
    else if(myTurn)text=lastEntry&&lastEntry.by===ctx.userId&&lastEntry.bonus?'Dapat 6! Lempar lagi 🎲':'Giliranmu! Lempar dadunya 🎲';
    else text=`Giliran ${ctx.partnerName||'pasanganmu'}…`;
    els.status.textContent=text;
    els.status.classList.toggle('is-mine',myTurn);
    if(state.winner){
      els.banner.textContent=state.winner===ctx.userId?'🏆 Kamu sampai di petak 100 lebih dulu!':`🏆 ${nameOf(state.winner)} sampai di petak 100 lebih dulu!`;
      els.start.hidden=false;els.start.textContent='Main lagi';
    }else els.start.textContent='Mulai main';
    els.log.replaceChildren(...state.log.slice(-4).reverse().map(entry=>el('li','',describe(entry))));
  }

  function spin(finalFace){
    return new Promise(resolve=>{
      const started=performance.now();els.die.classList.add('is-rolling');
      const tick=()=>{
        if(performance.now()-started>650){els.die.classList.remove('is-rolling');setDie(els.die,finalFace);resolve();return;}
        setDie(els.die,1+Math.floor(Math.random()*6));setTimeout(tick,70);
      };
      tick();
    });
  }

  async function rollDice(){
    if(busy||!isMyTurn())return;
    busy=true;els.roll.disabled=true;
    const roll=randomRoll();
    try{
      await spin(roll);
      const ctx=me(),preview=previewRoll(state,ctx.userId,roll);
      if(!preview)return;
      const body=preview.state.winner?'🏆 Ular tangga: aku sampai di petak 100!':preview.entry.bonus?'🎲 Ular tangga: dapat 6, aku lempar lagi!':'🎲 Ular tangga: giliranmu!';
      const row=await send({game:'snakes',type:'roll',gameId:state.gameId,seq:state.seq,roll},body);
      ingest(row);
    }catch(error){
      toast(String(error?.message||'').match(/fetch|network/i)?'Koneksi terputus. Lemparan belum terkirim, coba lagi.':'Lemparan belum terkirim, coba lagi.',{type:'error'});
    }finally{busy=false;if(opened)render();}
  }

  async function startGame(){
    if(busy||!me().partnerId)return;
    if(state.gameId&&!state.winner&&!window.confirm('Mulai permainan baru? Permainan yang sedang berjalan akan dihentikan.'))return;
    busy=true;
    try{
      const row=await send({game:'snakes',type:'start',gameId:crypto.randomUUID()},'🎲 Ular tangga: ayo main bareng!');
      ingest(row);
    }catch(error){toast('Permainan belum bisa dimulai, coba lagi.',{type:'error'});}
    finally{busy=false;if(opened)render();}
  }

  async function refresh(){
    try{ingest(await load());}catch(error){console.warn('Ular tangga belum bisa memuat langkah:',error);}
  }

  async function openGame(){
    if(!me().partnerId){toast('Pasanganmu belum bergabung.',{type:'error'});return;}
    await ensureStyles();
    if(!root)buildUI();
    opened=true;root.hidden=false;render();
    await refresh();
    if(opened)render();
  }

  function closeGame(){opened=false;if(root)root.hidden=true;}
  function close(){closeGame();}

  return{open:openGame,close,reset,ingest,isOpen:()=>opened,isMyTurn,getState:()=>state};
}

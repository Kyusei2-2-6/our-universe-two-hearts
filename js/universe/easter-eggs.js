import { toast } from '../components/toast.js';
import { events } from '../core/event-bus.js';

export class EasterEggs {
  constructor({ galaxyEngine, canvas, initials = '♡' }) {
    this.engine=galaxyEngine; this.canvas=canvas; this.initials=initials;
    this.starClicks=0; this.sequence=[]; this.longPressTimer=null; this.lastShake=0;
    this.bind();
  }
  bind(){
    this.canvas.addEventListener('click',()=>{ this.starClicks++; if(this.starClicks===7){ this.engine.meteorShower(88); toast('Tujuh bintang ditemukan. Hujan meteor dimulai ✦'); this.starClicks=0; } });
    this.canvas.addEventListener('pointerdown',()=>{ this.longPressTimer=setTimeout(()=>{ events.emit('secret:menu'); toast('Menu rahasia terbuka.'); },1200); });
    ['pointerup','pointercancel','pointerleave'].forEach(type=>this.canvas.addEventListener(type,()=>clearTimeout(this.longPressTimer)));
    addEventListener('keydown',event=>this.#konami(event));
    addEventListener('devicemotion',event=>this.#shake(event));
    events.on('moon:tap',()=>{ this.#dialogue(); });
  }
  #konami(event){
    const code=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    this.sequence.push(event.key); this.sequence=this.sequence.slice(-code.length);
    if(code.every((key,index)=>this.sequence[index]?.toLowerCase()===key.toLowerCase())){ this.heartExplosion(); toast(`Konstelasi rahasia ${this.initials} ditemukan.`); }
  }
  #shake(event){
    const a=event.accelerationIncludingGravity; if(!a)return;
    const force=Math.abs(a.x||0)+Math.abs(a.y||0)+Math.abs(a.z||0);
    if(force>34&&Date.now()-this.lastShake>2500){ this.lastShake=Date.now(); this.heartExplosion(); }
  }
  #dialogue(){ toast('Bulan berbisik: tidak semua jarak berarti jauh.'); }
  heartExplosion(){
    for(let i=0;i<64;i++){
      const heart=document.createElement('span'); heart.className='heart-particle'; heart.textContent=i%4?'♡':'♥';
      heart.style.setProperty('--tx',`${(Math.random()-.5)*110}vw`); heart.style.setProperty('--ty',`${(Math.random()-.5)*95}vh`); heart.style.setProperty('--rot',`${(Math.random()-.5)*720}deg`); heart.style.fontSize=`${12+Math.random()*28}px`; heart.style.color=`hsl(${300+Math.random()*55} 90% 78%)`;
      document.body.append(heart); setTimeout(()=>heart.remove(),1600);
    }
  }
}

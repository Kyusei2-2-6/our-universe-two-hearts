import * as THREE from 'https://esm.sh/three@0.185.1';
import { EffectComposer } from 'https://esm.sh/three@0.185.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.185.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.185.1/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'https://esm.sh/three@0.185.1/examples/jsm/postprocessing/AfterimagePass.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/index.js';
import { clamp, prefersReducedMotion } from '../core/utils.js';
import { events } from '../core/event-bus.js';

const vertexShader = `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
void main(){
  vColor=aColor;
  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=aSize*(255.0/-mvPosition.z);
  gl_Position=projectionMatrix*mvPosition;
}`;

const fragmentShader = `
varying vec3 vColor;
void main(){
  float d=distance(gl_PointCoord,vec2(.5));
  float alpha=smoothstep(.5,.06,d);
  gl_FragColor=vec4(vColor,alpha);
}`;

const THEMES = {
  'milky-way': {
    core:'#f7e8d0', arm:'#7192ff', accent:'#8edcff', fog:0x02040d,
    planets:[['#8ca6d7','#1d2b56'],['#d69a73','#553124'],['#8ad6c5','#173b46'],['#b39cff','#342957'],['#d6c5a3','#4d4232']]
  },
  'saturn-dream': {
    core:'#fff0c2', arm:'#a779ff', accent:'#ffbb85', fog:0x07040d,
    planets:[['#d8bd82','#4f3823'],['#c98cff','#3c2252'],['#8ea6ff','#253764'],['#e68da9','#542b42'],['#c5a26f','#4c3822']]
  },
  'lunar-ocean': {
    core:'#dcecff', arm:'#4bb8ff', accent:'#70f0e0', fog:0x010913,
    planets:[['#6ba6d9','#163b5b'],['#67d1c1','#174742'],['#8a9ed8','#24335e'],['#b7d8ef','#365166'],['#5e86c4','#1a2d50']]
  },
  'rose-cosmos': {
    core:'#ffe0eb', arm:'#cc79ff', accent:'#ff92c7', fog:0x0b030c,
    planets:[['#df8dac','#56273d'],['#b78de2','#3e2855'],['#e5b08e','#54362a'],['#8aa9d9','#243650'],['#d978a2','#4c2238']]
  }
};

export class GalaxyEngine {
  constructor(canvas, profile) {
    this.profile = profile;
    this.mobileComfort = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 5000);
    this.camera.position.set(0, 2.5, 38);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:false, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.profile.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.mobileComfort ? .50 : .63;
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this.reduced = prefersReducedMotion();
    this.mode = 'intro';
    this.growthLevel = 0;
    this.lastFrame = 0;
    this.disposed = false;
    this.spaceTheme = 'milky-way';
    this.planetData = [];
    this.#setupComposer();
    this.#buildScene();
    this.#bind();
    this.render();
  }

  #setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      this.profile.bloom ? (this.mobileComfort ? .045 : .11) : 0,
      .34,
      .72
    );
    this.bloom.enabled = this.profile.bloom;
    this.composer.addPass(this.bloom);
    this.afterimage = new AfterimagePass(.87);
    this.afterimage.enabled = false;
    this.composer.addPass(this.afterimage);
  }

  #buildScene() {
    const theme=THEMES[this.spaceTheme];
    this.scene.background = new THREE.Color('#010208');
    this.scene.fog = new THREE.FogExp2(theme.fog, .0085);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.stars = this.#makeStars(this.profile.stars, 1);
    this.root.add(this.stars);

    this.milkyWay = this.#makeMilkyWay(Math.max(2600, Math.round(this.profile.galaxy * .82)), theme);
    this.milkyWay.rotation.set(-.26, 0, -.46);
    this.milkyWay.position.set(0, -4, -34);
    this.root.add(this.milkyWay);

    this.galaxy = this.#makeGalaxy(Math.max(2400, Math.round(this.profile.galaxy * .66)), theme);
    this.galaxy.rotation.x = .30;
    this.galaxy.rotation.z = -.12;
    this.galaxy.position.set(0, -2, -8);
    this.root.add(this.galaxy);

    this.nebula = this.#makeNebula(theme);
    this.root.add(this.nebula);

    this.planets = this.#makePlanetSystem(theme);
    this.root.add(this.planets);

    this.asteroids = this.#makeAsteroids(this.profile.asteroids);
    this.asteroids.visible = false;
    this.root.add(this.asteroids);

    const ambient = new THREE.HemisphereLight(0x738cff, 0x080713, this.mobileComfort ? .46 : .62);
    const key = new THREE.DirectionalLight(0xffe8d6, this.mobileComfort ? 1.0 : 1.35);
    key.position.set(-12, 9, 18);
    const rim = new THREE.PointLight(0x6ba8ff, this.mobileComfort ? 1.0 : 1.8, 120, 2);
    rim.position.set(18, -6, 4);
    this.scene.add(ambient, key, rim);
  }

  #makeStars(count, radiusScale = 1) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const palette = [new THREE.Color('#ffffff'),new THREE.Color('#adc9ff'),new THREE.Color('#ffe2c8'),new THREE.Color('#c8b7ff')];
    for (let i=0;i<count;i++) {
      const radius=(80+Math.random()*700)*radiusScale;
      const theta=Math.random()*Math.PI*2;
      const phi=Math.acos(2*Math.random()-1);
      positions[i*3]=radius*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1]=radius*Math.cos(phi);
      positions[i*3+2]=radius*Math.sin(phi)*Math.sin(theta);
      const color=palette[(Math.random()*palette.length)|0];
      colors.set([color.r,color.g,color.b],i*3);
      sizes[i]=.48+Math.random()*2.15;
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
    return new THREE.Points(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  }

  #makeMilkyWay(count, theme) {
    const geometry=new THREE.BufferGeometry();
    const positions=new Float32Array(count*3);
    const colors=new Float32Array(count*3);
    const sizes=new Float32Array(count);
    const core=new THREE.Color(theme.core);
    const arm=new THREE.Color(theme.arm);
    for(let i=0;i<count;i++){
      const x=(Math.random()-.5)*180;
      const normalized=Math.abs(x)/90;
      const width=(1-normalized*.55)*(8+Math.random()*18);
      const y=(Math.random()-.5)*width + Math.sin(x*.035)*5;
      const z=(Math.random()-.5)*22 - 12;
      positions.set([x,y,z],i*3);
      const c=core.clone().lerp(arm,Math.min(1,normalized*.82+Math.random()*.22));
      colors.set([c.r,c.g,c.b],i*3);
      sizes[i]=.45+Math.random()*(this.mobileComfort?1.25:2.0);
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
    return new THREE.Points(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending}));
  }

  #makeGalaxy(count, theme) {
    const geometry=new THREE.BufferGeometry();
    const positions=new Float32Array(count*3);
    const colors=new Float32Array(count*3);
    const sizes=new Float32Array(count);
    const inner=new THREE.Color(theme.core);
    const outer=new THREE.Color(theme.arm);
    for(let i=0;i<count;i++){
      const radius=Math.pow(Math.random(),.58)*29;
      const branch=(i%5)/5*Math.PI*2;
      const spin=radius*.64;
      const random=Math.pow(Math.random(),2.2)*(Math.random()<.5?-1:1);
      positions[i*3]=Math.cos(branch+spin)*radius+random*4;
      positions[i*3+1]=random*1.25*(1-radius/38);
      positions[i*3+2]=Math.sin(branch+spin)*radius+random*4;
      const color=inner.clone().lerp(outer,radius/29);
      colors.set([color.r,color.g,color.b],i*3);
      sizes[i]=.42+Math.random()*(this.mobileComfort?1.35:2.15);
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
    return new THREE.Points(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  }

  #makeNebula(theme) {
    const group=new THREE.Group();
    const texture=this.#radialTexture([
      this.#rgba(theme.arm,.09),
      this.#rgba(theme.accent,.045),
      'rgba(0,0,0,0)'
    ]);
    const count=Math.max(2,Math.min(this.profile.nebula,this.mobileComfort?4:8));
    for(let i=0;i<count;i++){
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.035+Math.random()*.035,blending:THREE.AdditiveBlending,depthWrite:false}));
      sprite.position.set((Math.random()-.5)*62,(Math.random()-.5)*26,-20-Math.random()*48);
      sprite.scale.set(18+Math.random()*28,8+Math.random()*16,1);
      sprite.material.rotation=Math.random()*Math.PI;
      group.add(sprite);
    }
    return group;
  }

  #makePlanetSystem(theme) {
    const group=new THREE.Group();
    const segments=this.mobileComfort?24:42;
    const specs=[
      {radius:1.65,distance:26,speed:.024,y:9,z:-23,ring:true},
      {radius:1.05,distance:18,speed:-.032,y:-9,z:-17},
      {radius:.78,distance:34,speed:.017,y:-2,z:-38},
      {radius:1.25,distance:40,speed:-.012,y:13,z:-48,ring:true},
      {radius:.56,distance:14,speed:.041,y:6,z:-11}
    ];
    this.planetData=[];
    specs.slice(0,this.mobileComfort?4:5).forEach((spec,index)=>{
      const [light,dark]=theme.planets[index%theme.planets.length];
      const material=new THREE.MeshStandardMaterial({
        map:this.#planetTexture(light,dark,index),
        roughness:.82,
        metalness:.04
      });
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(spec.radius,segments,segments),material);
      mesh.position.set(spec.distance,spec.y,spec.z);
      group.add(mesh);
      let ring=null;
      if(spec.ring){
        ring=new THREE.Mesh(
          new THREE.RingGeometry(spec.radius*1.35,spec.radius*2.2,64),
          new THREE.MeshBasicMaterial({color:new THREE.Color(light),transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false})
        );
        ring.rotation.x=Math.PI*.55;
        mesh.add(ring);
      }
      this.planetData.push({mesh,spec,phase:index*1.37+Math.random()*.8,ring});
    });
    return group;
  }

  #planetTexture(light,dark,seed) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,256,256);
    gradient.addColorStop(0,light);gradient.addColorStop(.55,dark);gradient.addColorStop(1,'#080b18');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
    const random=this.#mulberry32(seed+91);
    for(let i=0;i<24;i++){
      ctx.globalAlpha=.04+random()*.12;
      ctx.fillStyle=random()>.5?'#ffffff':'#000000';
      const y=random()*256;const h=3+random()*22;
      ctx.beginPath();ctx.ellipse(128,y,150+random()*70,h,random()*.18,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;return texture;
  }

  #makeAsteroids(count) {
    const safeCount=Math.min(count,this.mobileComfort?90:220);
    const geometry=new THREE.IcosahedronGeometry(.28,0);
    const material=new THREE.MeshStandardMaterial({color:0x30374b,roughness:.9,metalness:.08});
    const mesh=new THREE.InstancedMesh(geometry,material,safeCount);
    const dummy=new THREE.Object3D();
    for(let i=0;i<safeCount;i++){
      const angle=Math.random()*Math.PI*2;const radius=6+Math.random()*18;
      dummy.position.set(Math.cos(angle)*radius,(Math.random()-.5)*9,-10-Math.random()*72);
      dummy.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      dummy.scale.setScalar(.28+Math.random()*1.7);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }
    return mesh;
  }

  #radialTexture(stops) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(128,128,0,128,128,128);
    stops.forEach((stop,index)=>gradient.addColorStop(index/(stops.length-1),stop));
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }

  #rgba(hex,alpha){const color=new THREE.Color(hex);return `rgba(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)},${alpha})`;}
  #mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

  #bind() {
    this.onResize=()=>{
      const width=innerWidth,height=innerHeight;
      this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.profile.pixelRatio));
      this.renderer.setSize(width,height,false);this.composer.setSize(width,height);
    };
    this.onPointer=event=>{
      this.pointerTarget.set((event.clientX/innerWidth-.5)*2,(event.clientY/innerHeight-.5)*2);
      events.emit('universe:pointer',{x:event.clientX,y:event.clientY});
    };
    addEventListener('resize',this.onResize,{passive:true});
    addEventListener('pointermove',this.onPointer,{passive:true});
    document.addEventListener('visibilitychange',()=>this.clock.getDelta());
  }

  setTheme(name='milky-way') {
    const next=THEMES[name]?name:'milky-way';
    document.documentElement.dataset.spaceTheme=next;
    if(next===this.spaceTheme)return;
    this.spaceTheme=next;
    const theme=THEMES[next];
    this.scene.fog.color.set(theme.fog);

    const oldMilky=this.milkyWay;const oldGalaxy=this.galaxy;const oldNebula=this.nebula;
    this.milkyWay=this.#makeMilkyWay(Math.max(2600,Math.round(this.profile.galaxy*.82)),theme);
    this.milkyWay.rotation.set(-.26,0,-.46);this.milkyWay.position.set(0,-4,-34);
    this.galaxy=this.#makeGalaxy(Math.max(2400,Math.round(this.profile.galaxy*.66)),theme);
    this.galaxy.rotation.x=.30;this.galaxy.rotation.z=-.12;this.galaxy.position.set(0,-2,-8);
    this.nebula=this.#makeNebula(theme);
    this.root.remove(oldMilky,oldGalaxy,oldNebula);this.root.add(this.milkyWay,this.galaxy,this.nebula);
    oldMilky.geometry.dispose();oldMilky.material.dispose();oldGalaxy.geometry.dispose();oldGalaxy.material.dispose();
    for(const child of oldNebula.children){child.material.map?.dispose?.();child.material.dispose();}

    this.planetData.forEach(({mesh},index)=>{
      const [light,dark]=theme.planets[index%theme.planets.length];
      const old=mesh.material.map;
      mesh.material.map=this.#planetTexture(light,dark,index+17);
      mesh.material.needsUpdate=true;
      old?.dispose?.();
    });
  }

  async playOpening(onQuote,onReady) {
    if(this.reduced){this.camera.position.set(0,3.5,32);this.mode='hub';onQuote?.();onReady?.();return;}
    this.camera.position.set(0,1,86);this.galaxy.scale.setScalar(.42);this.milkyWay.scale.setScalar(.7);
    this.bloom.strength=this.mobileComfort?.035:.075;
    const timeline=gsap.timeline({defaults:{ease:'power2.inOut'}});
    timeline.to(this.camera.position,{z:42,y:2.4,duration:6.2,ease:'power1.inOut'},0)
      .to(this.galaxy.scale,{x:1,y:1,z:1,duration:5.8},.2)
      .to(this.milkyWay.scale,{x:1,y:1,z:1,duration:6.4},0)
      .call(()=>onQuote?.(),null,2.1)
      .call(()=>onReady?.(),null,5.9);
    return timeline;
  }

  async enterUniverse() {
    this.mode='travel';this.asteroids.visible=true;
    this.afterimage.enabled=Boolean(this.profile.afterimage&&!this.reduced&&!this.mobileComfort);
    return new Promise(resolve=>{
      const tl=gsap.timeline({defaults:{ease:'power2.inOut'},onComplete:()=>{
        this.mode='hub';this.asteroids.visible=false;this.camera.position.set(0,3.5,32);this.camera.rotation.set(-.04,0,0);this.afterimage.enabled=false;resolve();
      }});
      tl.to(this.camera.position,{z:7,duration:1.35,ease:'power3.in'})
        .to(this.camera.rotation,{z:.07,duration:.75},0)
        .set(this.camera.position,{z:78,y:-1})
        .to(this.camera.position,{z:18,y:3.5,duration:2.25,ease:'power4.out'})
        .to(this.camera.rotation,{z:0,x:-.04,duration:1.7},'-=2.05')
        .to(this.bloom,{strength:this.mobileComfort?.065:.14,duration:.35},.8)
        .to(this.bloom,{strength:this.mobileComfort?.04:.09,duration:1.5},1.15);
    });
  }

  setGrowth(level) {
    this.growthLevel=clamp(level,0,10);
    const scale=.96+this.growthLevel*.025;
    gsap.to(this.galaxy.scale,{x:scale,y:scale,z:scale,duration:1.1});
    if(this.profile.bloom)gsap.to(this.bloom,{strength:(this.mobileComfort?.035:.075)+.003*this.growthLevel,duration:1});
  }

  meteorShower(count=48) {
    const geometry=new THREE.BufferGeometry();const positions=new Float32Array(count*3);const velocity=[];
    for(let i=0;i<count;i++){positions.set([(Math.random()-.5)*80,20+Math.random()*40,-10-Math.random()*80],i*3);velocity.push(.3+Math.random()*.8);}
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color:0xd9efff,size:.32,transparent:true,blending:THREE.AdditiveBlending});
    const meteors=new THREE.Points(geometry,material);this.scene.add(meteors);const start=performance.now();
    const animate=()=>{const elapsed=(performance.now()-start)/1000;const arr=geometry.attributes.position.array;
      for(let i=0;i<count;i++){arr[i*3]-=velocity[i]*1.8;arr[i*3+1]-=velocity[i]*5.5;}
      geometry.attributes.position.needsUpdate=true;material.opacity=Math.max(0,1-elapsed/3.5);
      if(elapsed<3.5)requestAnimationFrame(animate);else{this.scene.remove(meteors);geometry.dispose();material.dispose();}
    };animate();
  }

  render=()=>{
    if(this.disposed)return;requestAnimationFrame(this.render);
    const now=performance.now();if(now-this.lastFrame<1000/this.profile.fps)return;this.lastFrame=now;
    const dt=Math.min(this.clock.getDelta(),.05);const elapsed=this.clock.elapsedTime;
    this.pointer.lerp(this.pointerTarget,.045);
    if(this.mode==='hub'){
      this.camera.position.x+=(this.pointer.x*1.25-this.camera.position.x)*.012;
      this.camera.position.y+=(3.5-this.pointer.y*.62-this.camera.position.y)*.012;
      this.camera.lookAt(0,-.8,-8);
    }
    this.galaxy.rotation.y+=dt*.018;
    this.milkyWay.rotation.y-=dt*.0025;
    this.stars.rotation.y-=dt*.002;
    this.nebula.rotation.z=Math.sin(elapsed*.028)*.035;
    this.planetData.forEach(({mesh,spec,phase},index)=>{
      const angle=elapsed*spec.speed+phase;
      mesh.position.x=Math.cos(angle)*spec.distance;
      mesh.position.z=spec.z+Math.sin(angle)*8;
      mesh.position.y=spec.y+Math.sin(angle*.72+index)*1.8;
      mesh.rotation.y+=dt*(.08+index*.014);
      mesh.rotation.z=Math.sin(elapsed*.15+phase)*.06;
    });
    if(this.asteroids.visible)this.asteroids.rotation.z+=dt*.07;
    this.composer.render();
  };

  dispose(){
    this.disposed=true;removeEventListener('resize',this.onResize);removeEventListener('pointermove',this.onPointer);
    this.renderer.dispose();this.composer.dispose();
  }
}

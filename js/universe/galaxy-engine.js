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
  gl_PointSize=aSize*(260.0/-mvPosition.z);
  gl_Position=projectionMatrix*mvPosition;
}`;
const fragmentShader = `
varying vec3 vColor;
void main(){
  float d=distance(gl_PointCoord,vec2(.5));
  float alpha=smoothstep(.5,.08,d);
  gl_FragColor=vec4(vColor,alpha);
}`;

export class GalaxyEngine {
  constructor(canvas, profile) {
    this.profile = profile;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 5000);
    this.camera.position.set(0, 1.2, 34);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.profile.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .78;
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this.reduced = prefersReducedMotion();
    this.mode = 'intro';
    this.growthLevel = 0;
    this.lastFrame = 0;
    this.disposed = false;
    this.#setupComposer();
    this.#buildScene();
    this.#bind();
    this.render();
  }

  #setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), this.profile.bloom ? .58 : 0, .55, .28);
    this.bloom.enabled = this.profile.bloom;
    this.composer.addPass(this.bloom);
    this.afterimage = new AfterimagePass(.89);
    this.afterimage.enabled = Boolean(this.profile.afterimage && !this.reduced);
    this.composer.addPass(this.afterimage);
  }

  #buildScene() {
    this.scene.fog = new THREE.FogExp2(0x02030a, .012);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.stars = this.#makeStars(this.profile.stars, 1);
    this.root.add(this.stars);
    this.galaxy = this.#makeGalaxy(this.profile.galaxy);
    this.galaxy.rotation.x = .18;
    this.root.add(this.galaxy);
    this.nebula = this.#makeNebula();
    this.root.add(this.nebula);
    this.asteroids = this.#makeAsteroids(this.profile.asteroids);
    this.asteroids.visible = false;
    this.root.add(this.asteroids);
    this.flare = this.#makeFlare();
    this.flare.position.set(-9, 7, -15);
    this.root.add(this.flare);
    const ambient = new THREE.AmbientLight(0x7184ff, .72);
    const key = new THREE.PointLight(0xffa4da, 8, 90, 2);
    key.position.set(-8, 5, 8);
    this.scene.add(ambient, key);
  }

  #makeStars(count, radiusScale = 1) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const palette = [new THREE.Color('#ffffff'), new THREE.Color('#a9c9ff'), new THREE.Color('#ffd2ec'), new THREE.Color('#c8b5ff')];
    for (let i = 0; i < count; i++) {
      const radius = (80 + Math.random() * 620) * radiusScale;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i*3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = radius * Math.cos(phi);
      positions[i*3+2] = radius * Math.sin(phi) * Math.sin(theta);
      const color = palette[(Math.random() * palette.length) | 0];
      colors.set([color.r,color.g,color.b], i*3);
      sizes[i] = .55 + Math.random() * 2.5;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
    return new THREE.Points(geometry, material);
  }

  #makeGalaxy(count) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const inner = new THREE.Color('#ffe0f2');
    const outer = new THREE.Color('#596dff');
    for (let i=0;i<count;i++) {
      const radius = Math.pow(Math.random(), .56) * 24;
      const branch = (i % 5) / 5 * Math.PI * 2;
      const spin = radius * .72;
      const random = Math.pow(Math.random(), 2.5) * (Math.random() < .5 ? -1 : 1);
      positions[i*3] = Math.cos(branch + spin) * radius + random * 3.2;
      positions[i*3+1] = random * 1.1 * (1 - radius/32);
      positions[i*3+2] = Math.sin(branch + spin) * radius + random * 3.2;
      const color = inner.clone().lerp(outer, radius/24);
      colors.set([color.r,color.g,color.b],i*3);
      sizes[i] = .45 + Math.random()*2.3;
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
    return new THREE.Points(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  }

  #makeNebula() {
    const group = new THREE.Group();
    const texture = this.#radialTexture(['rgba(255,120,210,.28)','rgba(92,70,210,.14)','rgba(0,0,0,0)']);
    for (let i=0;i<this.profile.nebula;i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, transparent:true, opacity:.10 + Math.random()*.10, blending:THREE.AdditiveBlending, depthWrite:false }));
      sprite.position.set((Math.random()-.5)*30,(Math.random()-.5)*12,-8-Math.random()*18);
      sprite.scale.set(18+Math.random()*28,8+Math.random()*15,1);
      sprite.material.rotation = Math.random()*Math.PI;
      group.add(sprite);
    }
    return group;
  }

  #makeFlare() {
    const texture = this.#radialTexture(['rgba(255,255,255,.42)','rgba(120,205,255,.16)','rgba(0,0,0,0)']);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    sprite.scale.set(3.6,3.6,1);
    return sprite;
  }

  #radialTexture(stops) {
    const canvas = document.createElement('canvas'); canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d'); const gradient=ctx.createRadialGradient(128,128,0,128,128,128);
    stops.forEach((stop,index)=>gradient.addColorStop(index/(stops.length-1),stop));
    ctx.fillStyle=gradient; ctx.fillRect(0,0,256,256);
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; return texture;
  }

  #makeAsteroids(count) {
    const geometry = new THREE.IcosahedronGeometry(.28, 0);
    const material = new THREE.MeshStandardMaterial({ color:0x39405b, roughness:.82, metalness:.16 });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    for (let i=0;i<count;i++) {
      const angle=Math.random()*Math.PI*2; const radius=6+Math.random()*16;
      dummy.position.set(Math.cos(angle)*radius,(Math.random()-.5)*8,-10-Math.random()*70);
      dummy.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      const scale=.35+Math.random()*2.2; dummy.scale.setScalar(scale); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
    }
    return mesh;
  }

  #bind() {
    this.onResize = () => {
      const width=innerWidth,height=innerHeight;
      this.camera.aspect=width/height; this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.profile.pixelRatio));
      this.renderer.setSize(width,height,false); this.composer.setSize(width,height);
    };
    this.onPointer = event => {
      this.pointerTarget.set((event.clientX/innerWidth-.5)*2,(event.clientY/innerHeight-.5)*2);
      events.emit('universe:pointer',{x:event.clientX,y:event.clientY});
    };
    addEventListener('resize',this.onResize,{passive:true});
    addEventListener('pointermove',this.onPointer,{passive:true});
    document.addEventListener('visibilitychange',()=>{ this.clock.getDelta(); });
  }

  async playOpening(onQuote, onReady) {
    if (this.reduced) {
      this.camera.position.set(0,5,28); this.mode='hub'; onQuote?.(); onReady?.(); return;
    }
    this.camera.position.set(0,0,80);
    this.galaxy.scale.setScalar(.3);
    this.bloom.strength=.3;
    const timeline=gsap.timeline({defaults:{ease:'power2.inOut'}});
    timeline.to(this.bloom,{strength:.66,duration:3.2},0)
      .to(this.camera.position,{z:38,y:1.2,duration:6.6,ease:'power1.inOut'},0)
      .to(this.galaxy.scale,{x:1,y:1,z:1,duration:6.2},.3)
      .call(()=>onQuote?.(),null,2.4)
      .call(()=>onReady?.(),null,6.4);
    return timeline;
  }

  async enterUniverse() {
    this.mode='travel';
    this.asteroids.visible=true;
    this.afterimage.enabled=Boolean(this.profile.afterimage && !this.reduced);
    return new Promise(resolve => {
      const tl=gsap.timeline({defaults:{ease:'power2.inOut'},onComplete:()=>{
        this.mode='hub'; this.asteroids.visible=false; this.camera.position.set(0,5,28); this.camera.rotation.set(-.08,0,0); this.afterimage.enabled=false; resolve();
      }});
      tl.to(this.camera.position,{z:4,duration:1.4,ease:'power3.in'})
        .to(this.camera.rotation,{z:.08,duration:.8},0)
        .set(this.camera.position,{z:70,y:-2})
        .to(this.camera.position,{z:12,y:4,duration:2.4,ease:'power4.out'})
        .to(this.camera.rotation,{z:0,x:-.08,duration:1.8},'-=2.2')
        .to(this.bloom,{strength:.82,duration:.4},.9)
        .to(this.bloom,{strength:.58,duration:1.8},1.35);
    });
  }

  setGrowth(level) {
    this.growthLevel=clamp(level,0,10);
    const scale=.94+this.growthLevel*.041;
    gsap.to(this.galaxy.scale,{x:scale,y:scale,z:scale,duration:1.2});
    if(this.profile.bloom) gsap.to(this.bloom,{strength:.48+.022*this.growthLevel,duration:1});
  }

  meteorShower(count=48) {
    const geometry=new THREE.BufferGeometry(); const positions=new Float32Array(count*3); const velocity=[];
    for(let i=0;i<count;i++){ positions.set([(Math.random()-.5)*80,20+Math.random()*40,-10-Math.random()*80],i*3); velocity.push(.3+Math.random()*.8); }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color:0xd9efff,size:.35,transparent:true,blending:THREE.AdditiveBlending});
    const meteors=new THREE.Points(geometry,material); this.scene.add(meteors);
    const start=performance.now();
    const animate=()=>{ const elapsed=(performance.now()-start)/1000; const arr=geometry.attributes.position.array;
      for(let i=0;i<count;i++){ arr[i*3]-=velocity[i]*1.8; arr[i*3+1]-=velocity[i]*5.5; }
      geometry.attributes.position.needsUpdate=true; material.opacity=Math.max(0,1-elapsed/3.5);
      if(elapsed<3.5) requestAnimationFrame(animate); else { this.scene.remove(meteors); geometry.dispose(); material.dispose(); }
    }; animate();
  }

  render = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.render);
    const now=performance.now();
    if(now-this.lastFrame < 1000/this.profile.fps) return;
    this.lastFrame=now;
    const dt=Math.min(this.clock.getDelta(),.05); const elapsed=this.clock.elapsedTime;
    this.pointer.lerp(this.pointerTarget,.04);
    if(this.mode==='hub'){
      this.camera.position.x += (this.pointer.x*1.7-this.camera.position.x)*.015;
      this.camera.position.y += (5-this.pointer.y*.8-this.camera.position.y)*.015;
      this.camera.lookAt(0,0,0);
    }
    this.galaxy.rotation.y += dt*.025;
    this.stars.rotation.y -= dt*.003;
    this.nebula.rotation.z=Math.sin(elapsed*.035)*.06;
    this.flare.material.opacity=.18+Math.sin(elapsed*1.4)*.035;
    if(this.asteroids.visible) this.asteroids.rotation.z+=dt*.07;
    this.composer.render();
  };

  dispose() {
    this.disposed=true; removeEventListener('resize',this.onResize); removeEventListener('pointermove',this.onPointer);
    this.renderer.dispose(); this.composer.dispose();
  }
}

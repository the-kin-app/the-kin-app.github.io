// three, the loaders and Min's mesh are ~600 KB and a standing GPU load, so
// nothing is fetched until we know this device actually wants them. THREE is
// module-scoped rather than a static import for the same reason: the helpers
// below need it, boot() supplies it.
const CDN='https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/';
let THREE, GLTFLoader, MeshoptDecoder, RoomEnvironment, phoneScreenTexture;

const figure=document.querySelector('.hero__preview');
const host=document.querySelector('.min-companion');
const button=document.querySelector('.min-motion');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
// Data Saver and 2G keep the still image; so does a device that has told us
// it is short on memory. Neither can spare the download or the frames.
const net=navigator.connection;
const thin=net?.saveData===true||/(^|-)2g$/.test(net?.effectiveType||'')||navigator.deviceMemory<=2;
let paused=reduced.matches, visible=true, sync=()=>{};
const updateButton=()=>{ button.textContent=paused?'Play Min':'Pause Min';button.setAttribute('aria-pressed',String(paused)); };
updateButton();
button.addEventListener('click',()=>{paused=!paused;updateButton();sync();});
reduced.addEventListener('change',e=>{paused=e.matches;updateButton();sync();});
new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();},{rootMargin:'80px'}).observe(host);
document.addEventListener('visibilitychange',()=>sync());

// Rounded hardware is real geometry, including the frame, glass and buttons.
function roundedShape(w,h,r) {
  const s=new THREE.Shape();const x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function slab(w,h,depth,r,material,bevel=.025) {
  const g=new THREE.ExtrudeGeometry(roundedShape(w,h,r),{depth,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:16});
  g.translate(0,0,-depth/2);const mesh=new THREE.Mesh(g,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function radialTexture(stops) {
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  stops.forEach(([at,color])=>gradient.addColorStop(at,color));ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}

async function boot() {
  [THREE,{GLTFLoader},{MeshoptDecoder},{RoomEnvironment},{phoneScreenTexture}]=await Promise.all([
    import('three'),
    import(CDN+'loaders/GLTFLoader.js'),
    import(CDN+'libs/meshopt_decoder.module.js'),
    import(CDN+'environments/RoomEnvironment.js'),
    import('./min-phone-screen.js?v=20260911d'),
  ]);
  const dense=devicePixelRatio>1.5, small=innerWidth<=800;
  const renderer=new THREE.WebGLRenderer({canvas:host.querySelector('canvas'),alpha:true,antialias:!dense,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,small?1.5:2));renderer.setClearColor(0x000000,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(30,1,.1,40);
  camera.position.set(0,3.4,11);camera.lookAt(0,2.35,0);
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.025);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff3e5,0xa28c79,.4));
  const sun=new THREE.DirectionalLight(0xffe8cf,1.7);sun.position.set(3,12,-2);sun.castShadow=true;
  sun.shadow.mapSize.set(small?512:768,small?512:768);sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;Object.assign(sun.shadow.camera,{left:-5,right:5,top:7,bottom:-4,near:.1,far:20});
  sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=8;sun.shadow.blurSamples=8;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xfff7ef,.35);fill.position.set(-4,3,5);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({color:0x705846,opacity:.21}));
  floor.material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vFloorWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader='varying vec3 vFloorWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\ngl_FragColor.a *= (1.0 - smoothstep(1.85, 2.2, abs(vFloorWorld.x))) * (1.0 - smoothstep(1.3, 2.2, abs(vFloorWorld.z)));');
  };
  floor.rotation.x=-Math.PI/2;floor.position.y=-.007;floor.receiveShadow=true;scene.add(floor);
  const contact=radialTexture([[0,'rgba(69,46,29,.46)'],[.3,'rgba(69,46,29,.27)'],[1,'rgba(69,46,29,0)']]);
  function floorPatch(texture,x,z,w,h,opacity=1) {
    const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity,depthWrite:false,toneMapped:false}));
    p.rotation.x=-Math.PI/2;p.position.set(x,.004,z);scene.add(p);return p;
  }
  // Min's mesh streams in while the phone and its screen texture are built.
  const gltfPromise=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/assets/models/min-home.glb');
  const phone=new THREE.Group();
  const metal=new THREE.MeshStandardMaterial({color:0x8d8075,metalness:.85,roughness:.28,envMapIntensity:.85});
  const edge=new THREE.MeshStandardMaterial({color:0x2a2422,metalness:.6,roughness:.22});
  phone.add(slab(2.34,4.96,.19,.29,metal,.045));
  const bezel=slab(2.29,4.91,.025,.28,edge,.018);bezel.position.z=.12;phone.add(bezel);
  const screenTexture=await phoneScreenTexture(THREE,small?.5:1);
  const screenGeometry=new THREE.ShapeGeometry(roundedShape(2.19,4.74,.245),24);
  const p=screenGeometry.attributes.position,uv=screenGeometry.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+1.095)/2.19,(p.getY(i)+2.37)/4.74);
  const screen=new THREE.Mesh(screenGeometry,new THREE.MeshPhysicalMaterial({map:screenTexture,emissiveMap:screenTexture,emissive:0xffffff,emissiveIntensity:.8,roughness:.23,metalness:0,clearcoat:1,clearcoatRoughness:.15,envMapIntensity:.18}));
  screen.position.z=.157;phone.add(screen);
  for(const [x,y,h] of [[-1.19,1.12,.31],[-1.19,.64,.48],[1.19,.85,.64]]) {
    const key=slab(.035,h,.10,.016,metal,.008);key.position.set(x,y,0);phone.add(key);
  }
  // A discreet rear support lets the inclined phone rest physically on the floor.
  const support=new THREE.Mesh(new THREE.BoxGeometry(.52,1.55,.07),metal);support.position.set(.1,-1.65,-.44);support.rotation.x=-.48;support.castShadow=true;phone.add(support);
  phone.rotation.set(-.09,-.27,-.045);phone.position.set(.66,0,-.10);scene.add(phone);
  phone.updateMatrixWorld(true);phone.position.y-=new THREE.Box3().setFromObject(phone).min.y;
  floorPatch(contact,.66,-.10,3,1.4,.7);

  const gltf=await gltfPromise;
  const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model);const center=bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-bounds.min.y,-center.z);
  const min=new THREE.Group();min.add(model);min.scale.setScalar(.66);min.position.set(-1.25,0,.85);min.rotation.y=.12;scene.add(min);
  const lampUniform={value:2.6};
  const shell=new THREE.MeshPhysicalMaterial({color:0xa18f7c,roughness:.62,metalness:0,ior:1.42,clearcoat:.08,clearcoatRoughness:.65,envMapIntensity:.20});
  // Approximate the Blender volume's diffuse internal scattering in the shell,
  // with less transmission at its silhouette and brighter warmth near the base.
  shell.onBeforeCompile=shader=>{
    shader.uniforms.lampStrength=lampUniform;
    shader.vertexShader='varying vec3 vShellPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvShellPosition = position;');
    shader.fragmentShader='varying vec3 vShellPosition;\nuniform float lampStrength;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      vec2 coreDistance = vec2(vShellPosition.x / .85, (vShellPosition.y - .95) / .95);
      float core = exp(-dot(coreDistance, coreDistance));
      float baseDistance = (vShellPosition.y - .13) / .22;
      float base = exp(-baseDistance * baseDistance);
      float facing = pow(max(dot(normal, normalize(vViewPosition)), 0.0), 1.6);
      totalEmissiveRadiance += vec3(1.0, .32, .075) * lampStrength * (core * (.20 + .8 * facing) + .5 * base);
    `);
  };
  const eyes=[];
  model.traverse(o=>{
    if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
    if(o.name==='MinBody'){o.material=shell;}
    else if(o.name.startsWith('Eye')){
      o.material=new THREE.MeshStandardMaterial({color:0xfffcf0,emissive:0xffe8be,emissiveIntensity:3.8,roughness:.6});
      eyes.push({mesh:o,scale:o.scale.y});
    }
  });
  floorPatch(contact,-1.25,.85,1.75,1.15,.95);
  const warm=radialTexture([[0,'rgba(255,190,88,.65)'],[.28,'rgba(255,190,88,.23)'],[1,'rgba(255,190,88,0)']]);
  const pool=floorPatch(warm,-1.25,.93,2.8,2.2,.65);pool.position.y=.007;
  const bounce=new THREE.PointLight(0xffb95d,.45,3,1);bounce.position.set(-1.25,.3,1.03);scene.add(bounce);
  // Eye bloom uses soft world-space halos; it never moves independently of Min.
  const haloMap=radialTexture([[0,'rgba(255,228,174,.5)'],[.23,'rgba(255,201,111,.22)'],[1,'rgba(255,191,94,0)']]);
  for(const eye of eyes){const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloMap,transparent:true,depthWrite:false,toneMapped:false,opacity:.65}));halo.scale.set(.72,.72,1);halo.position.copy(eye.mesh.position);halo.position.z+=.03;model.add(halo);eye.halo=halo;}

  const draw=()=>renderer.render(scene,camera);
  // Mobile toolbars retract on scroll and hand the observer a one- or
  // two-pixel height change; reframing on that is what made Min pulse.
  let lastW=0,lastH=0;
  const resize=()=>{
    const w=Math.round(host.clientWidth),h=Math.round(host.clientHeight);
    if(!w||!h||(w===lastW&&h===lastH))return;
    lastW=w;lastH=h;
    renderer.setSize(w,h,false);camera.aspect=w/h;
    camera.position.z=Math.max(11, 2.25 / (Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * camera.aspect));camera.updateProjectionMatrix();draw();
  };
  /* The room's slot on a phone is a plain pixel height, measured once.
     svh was supposed to be the stable viewport unit, but the browser still
     moves it as its toolbars retract on scroll — which grew the box and
     shoved the waitlist button down the screen. A number written once can't
     do that. Re-measured only when the width changes, i.e. on rotation. */
  const mobile=matchMedia('(max-width: 800px)');
  const hero=figure.closest('.hero');
  const fitRoom=()=>{
    if(!mobile.matches){figure.style.height='';hero.style.minHeight='';return;}
    // The hero gets the same treatment: one screen, measured once, so the
    // whole column stops re-centring itself every time the toolbar moves.
    hero.style.minHeight=innerHeight+'px';
    figure.style.height=Math.round(Math.min(Math.max(innerHeight*.36,180),320))+'px';
  };
  let lastViewportWidth=innerWidth;
  addEventListener('resize',()=>{
    if(innerWidth===lastViewportWidth)return;   // height-only = toolbar, ignore
    lastViewportWidth=innerWidth;fitRoom();
  },{passive:true});
  mobile.addEventListener('change',fitRoom);
  fitRoom();

  new ResizeObserver(resize).observe(host);resize();
  figure.classList.add('is-3d-ready');host.classList.add('is-ready');button.hidden=false;
  // Feet remain at y=0: only vertical breathing and tiny attentive turns.
  let last=0,elapsed=0,frame=0,running=false;
  const tick=now=>{
    if(now-last<1000/30)return;
    const delta=Math.min((now-last)/1000,.05);last=now;
    elapsed+=delta;min.scale.y=.66*(1+Math.sin(elapsed*1.35)*.009);
    min.rotation.y=.12+Math.sin(elapsed*.42)*.065;
    lampUniform.value=2.6+Math.sin(elapsed*1.35)*.055;
    const phase=elapsed%6.4;
    const blink=phase>6.1?1-.93*Math.sin((phase-6.1)/.3*Math.PI):1;
    for(const eye of eyes){eye.mesh.scale.y=eye.scale*blink;eye.halo.material.opacity=.65*blink;}
    sun.shadow.needsUpdate=frame++%3===0;
    draw();
  };
  sync=()=>{
    const should=visible&&!document.hidden&&!paused;
    if(should===running)return;
    running=should;
    if(should){last=performance.now();renderer.setAnimationLoop(tick);}
    else{renderer.setAnimationLoop(null);sun.shadow.needsUpdate=true;draw();}
  };
  sync();
  host.querySelector('canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();figure.classList.remove('is-3d-ready');host.classList.remove('is-ready');button.hidden=true;renderer.setAnimationLoop(null);running=false;sync=()=>{};});
}

if(thin){button.hidden=true;}
else boot().catch(error=>{sync=()=>{};button.hidden=true;figure.classList.remove('is-3d-ready');host.classList.remove('is-ready');console.warn('Min’s 3D room is unavailable; showing the still preview.',error);});

/* Geographies globe (extracted unchanged from the previous index.html). Needs three.js r128. */
/* ================= GLOBE ================= */
(function(){
  const holder = document.getElementById('globe-holder');
  if(!holder || typeof THREE === 'undefined') return;

  const DOT=0x8fe23c, GRID=0x1e5233, OCEAN=0x0c1a12, MARK=0xffffff;
  const R=1, STEP=1.9, SPIN=0.0015, SENS=0.005;
  // Kanpur, Delhi, Lucknow, Ludhiana, Mumbai, Gujarat (Ahmedabad), Bangalore, Chennai, Coimbatore, Kolkata
  const MARKERS=[[26.45,80.33],[28.61,77.21],[26.85,80.95],[30.90,75.85],[19.08,72.88],
                 [23.02,72.57],[12.97,77.59],[13.08,80.27],[11.02,76.96],[22.57,88.36]];
  const HOME_X=0.38, HOME_Y=-1.38; // centres India (lat ~22, lng ~79) facing the camera

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50,1,0.1,100);
  cam.position.set(0,0,2.6);
  const rend = new THREE.WebGLRenderer({antialias:true, alpha:true});
  rend.setPixelRatio(Math.min(window.devicePixelRatio,2));
  holder.appendChild(rend.domElement);

  const globe = new THREE.Group();
  globe.rotation.x = HOME_X; globe.rotation.y = HOME_Y;
  scene.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R*0.985,64,64), new THREE.MeshBasicMaterial({color:OCEAN})));

  function vec(lat,lng,r){
    const a=lat*Math.PI/180, o=lng*Math.PI/180;
    return new THREE.Vector3(Math.cos(a)*Math.sin(o)*r, Math.sin(a)*r, Math.cos(a)*Math.cos(o)*r);
  }
  (function grid(){
    const mat = new THREE.LineBasicMaterial({color:GRID, transparent:true, opacity:0.5});
    const add = pts => globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    for(let lat=-60;lat<=60;lat+=30){ const p=[]; for(let i=0;i<=90;i++) p.push(vec(lat,(i/90)*360-180,R*1.001)); add(p); }
    for(let lng=-180;lng<180;lng+=30){ const p=[]; for(let i=0;i<=90;i++) p.push(vec((i/90)*180-90,lng,R*1.001)); add(p); }
  })();

  const FALLBACK = [
    [[-17,15],[-17,21],[-13,28],[-6,36],[3,37],[11,37],[20,32],[25,32],[32,31],[36,28],[38,18],[43,12],[51,12],[48,4],[41,-2],[40,-11],[35,-18],[33,-26],[28,-32],[20,-34],[16,-28],[12,-18],[13,-9],[9,-1],[9,5],[3,6],[-4,5],[-8,4],[-13,9]],
    [[-10,36],[-9,43],[-2,43],[0,49],[4,52],[8,54],[11,58],[18,60],[24,60],[28,60],[30,66],[24,70],[16,68],[12,64],[8,58],[5,53],[-2,49],[-5,43]],
    [[26,40],[35,37],[45,40],[50,45],[60,50],[70,55],[80,60],[95,62],[110,65],[125,68],[140,70],[150,65],[142,55],[135,48],[130,42],[126,38],[122,31],[119,25],[110,21],[105,15],[100,8],[95,16],[90,22],[82,18],[77,8],[72,20],[68,25],[62,25],[58,30],[52,29],[45,25],[43,13],[38,18],[35,30],[30,31],[28,37]],
    [[-168,66],[-160,70],[-145,70],[-130,70],[-115,72],[-100,70],[-85,68],[-70,63],[-60,55],[-66,45],[-70,42],[-75,36],[-81,31],[-81,25],[-90,29],[-97,26],[-105,22],[-110,24],[-117,32],[-124,40],[-130,52],[-140,60],[-155,58],[-165,60]],
    [[-81,8],[-75,10],[-62,10],[-52,5],[-44,-2],[-38,-6],[-35,-8],[-38,-13],[-42,-23],[-48,-25],[-53,-34],[-58,-38],[-62,-40],[-65,-45],[-69,-52],[-74,-50],[-73,-42],[-71,-33],[-70,-23],[-75,-14],[-80,-5],[-79,2]],
    [[113,-22],[122,-18],[130,-12],[137,-12],[142,-11],[146,-19],[151,-24],[153,-28],[150,-37],[143,-39],[135,-35],[129,-32],[121,-34],[115,-34],[113,-26]],
    [[-55,83],[-30,83],[-20,76],[-22,70],[-40,60],[-50,62],[-55,68],[-60,76]]
  ];

  function rasterise(features){
    const W=1024, H=512;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const x=c.getContext('2d',{willReadFrequently:true});
    x.fillStyle='#000'; x.fillRect(0,0,W,H);
    x.fillStyle='#fff';
    const X = lng => ((lng+180)/360)*W;
    const Y = lat => ((90-lat)/180)*H;
    function ring(pts){
      if(pts.length < 3) return;
      x.beginPath();
      let prev = null;
      pts.forEach(pt => {
        const lng = pt[0], lat = pt[1];
        if(prev !== null && Math.abs(lng - prev) > 180){
          x.closePath(); x.fill(); x.beginPath();
          x.moveTo(X(lng), Y(lat));
        } else if(prev === null){
          x.moveTo(X(lng), Y(lat));
        } else {
          x.lineTo(X(lng), Y(lat));
        }
        prev = lng;
      });
      x.closePath(); x.fill();
    }
    features.forEach(f => {
      const g = f.geometry || f;
      if(!g) return;
      if(g.type === 'Polygon') g.coordinates.forEach(r => ring(r));
      else if(g.type === 'MultiPolygon') g.coordinates.forEach(poly => poly.forEach(r => ring(r)));
      else if(Array.isArray(g)) ring(g);
    });
    return {px:x.getImageData(0,0,W,H).data, W:W, H:H};
  }

  function plot(mask){
    const onLand = (lat,lng) => {
      const i = Math.round(((lng+180)/360)*mask.W) % mask.W;
      const j = Math.max(0, Math.min(mask.H-1, Math.round(((90-lat)/180)*mask.H)));
      return mask.px[(j*mask.W+i)*4] > 128;
    };
    const pts=[];
    for(let lat=-84; lat<=84; lat+=STEP){
      const cos = Math.cos(Math.abs(lat)*Math.PI/180);
      const s = cos > 0.02 ? STEP/Math.max(0.25,cos) : 360;
      for(let lng=-180; lng<180; lng+=s) if(onLand(lat,lng)) pts.push([lat,lng]);
    }
    if(!pts.length) return false;
    const inst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.0082,6,6),
      new THREE.MeshBasicMaterial({color:DOT}),
      pts.length
    );
    const m = new THREE.Matrix4();
    pts.forEach(([lat,lng],i) => inst.setMatrixAt(i, m.identity().setPosition(vec(lat,lng,R*1.004))));
    inst.instanceMatrix.needsUpdate = true;
    globe.add(inst);
    return true;
  }

  (function markers(){
    const g = new THREE.SphereGeometry(0.018,12,12);
    const m = new THREE.MeshBasicMaterial({color:MARK});
    MARKERS.forEach(([lat,lng]) => {
      const d = new THREE.Mesh(g,m);
      d.position.copy(vec(lat,lng,R*1.018));
      globe.add(d);
    });
  })();

  let placeholder = plot(rasterise(FALLBACK.map(r => ({type:'Polygon', coordinates:[r]}))));
  let placeholderMesh = placeholder ? globe.children[globe.children.length-1] : null;

  (async function upgrade(){
    const urls = [
      'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_land.json',
      'https://cdn.jsdelivr.net/gh/martynafford/natural-earth-geojson@master/110m/physical/ne_110m_land.json'
    ];
    for(const url of urls){
      try{
        const res = await fetch(url, {mode:'cors'});
        if(!res.ok) continue;
        const data = await res.json();
        if(!data || !data.features) continue;
        if(placeholderMesh){ globe.remove(placeholderMesh); placeholderMesh.geometry.dispose(); }
        plot(rasterise(data.features));
        return;
      }catch(e){ /* try next */ }
    }
  })();

  let drag=false, lx=0, ly=0, vx=0, vy=0, hov=false;
  const el = rend.domElement;
  el.addEventListener('pointerdown', e => { drag=true; vx=vy=0; lx=e.clientX; ly=e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if(!drag) return;
    const dx=e.clientX-lx, dy=e.clientY-ly;
    globe.rotation.y += dx*SENS;
    globe.rotation.x = Math.max(-1.1, Math.min(1.1, globe.rotation.x + dy*SENS));
    vx = dx*SENS*0.4; vy = dy*SENS*0.4;
    lx=e.clientX; ly=e.clientY;
  });
  const up = () => drag=false;
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  holder.addEventListener('pointerenter', () => hov=true);
  holder.addEventListener('pointerleave', () => hov=false);

  function size(){
    const w = holder.clientWidth||380, h = holder.clientHeight||380;
    rend.setSize(w,h,false);
    el.style.width='100%'; el.style.height='100%';
    cam.aspect=w/h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(holder); size();

  let vis=true;
  if('IntersectionObserver' in window){
    new IntersectionObserver(es => vis = es[0].isIntersecting, {threshold:0}).observe(holder);
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop(){
    requestAnimationFrame(loop);
    if(!vis) return;
    if(!drag){
      if(Math.abs(vx)>1e-5 || Math.abs(vy)>1e-5){
        globe.rotation.y += vx;
        globe.rotation.x = Math.max(-1.1, Math.min(1.1, globe.rotation.x + vy));
        vx*=0.94; vy*=0.94;
      } else if(!hov && !reduced){
        const t = performance.now() / 1000;
        let dy = HOME_Y + Math.sin(t * 0.22) * 0.32 - globe.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        globe.rotation.y += dy * 0.02;
        globe.rotation.x += (HOME_X - globe.rotation.x) * 0.02;
      }
    }
    rend.render(scene,cam);
  })();
})();

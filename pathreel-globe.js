// pathreel-globe.js
// ---------------------------------------------------------------------------
// Photoreal Earth for pathreel-site/index.html
// Replaces the procedural canvas-textured globe with NASA Blue Marble +
// drifting clouds + night-side city lights + ocean specular + atmospheric rim.
//
// Drop-in: include AFTER three.min.js in <head> or before </body>.
//
//   <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
//   <script src="pathreel-globe.js"></script>
//
// Then call:
//   PathReelGlobe.mount({
//     el: document.getElementById('globeCanvas'),
//     pins: window.PR_PINS,        // optional: [{lat, lng, color}]
//     size: 620,                   // matches .globe-wrap width/height
//   });
//
// Returns a handle with .destroy() for cleanup if you ever swap pages.
// ---------------------------------------------------------------------------

(function () {
  if (typeof window === 'undefined') return;

  const TEX_BASE = 'https://unpkg.com/three-globe@2.31.1/example/img';
  const URLS = {
    earth:  TEX_BASE + '/earth-blue-marble.jpg',
    bump:   TEX_BASE + '/earth-topology.png',
    spec:   TEX_BASE + '/earth-water.png',
    clouds: TEX_BASE + '/clouds.png',
    night:  TEX_BASE + '/earth-night.jpg',
  };

  function mount(opts) {
    const THREE = window.THREE;
    if (!THREE) {
      console.warn('[PathReelGlobe] three.js not found on window. Include three.min.js first.');
      return { destroy() {} };
    }

    const el        = opts.el;
    const size      = opts.size      || 620;
    const pins      = opts.pins      || [];
    const autoRotate = opts.autoRotate !== false;

    if (!el) {
      console.warn('[PathReelGlobe] mount() needs { el }');
      return { destroy() {} };
    }
    while (el.firstChild) el.removeChild(el.firstChild);

    // ---------- scene ----------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // ---------- earth ----------
    const earthGeo = new THREE.SphereGeometry(1.5, 96, 96);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 35,
      specular: new THREE.Color(0x4a6f9a),
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earth);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    let earthTex = null;
    loader.load(
      URLS.earth,
      function (tex) {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        earthMat.map = tex;
        earthMat.needsUpdate = true;
        earthTex = tex;
      },
      undefined,
      function () {
        // Procedural fallback if CDN blocked
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        const cx = c.getContext('2d');
        const g = cx.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0, '#0a2540');
        g.addColorStop(0.5, '#0d3a66');
        g.addColorStop(1, '#0a2540');
        cx.fillStyle = g; cx.fillRect(0, 0, 1024, 512);
        cx.fillStyle = '#1a4f1a';
        cx.fillRect(80, 120, 220, 90);
        cx.fillRect(380, 100, 280, 130);
        cx.fillRect(700, 90,  220, 110);
        const fb = new THREE.CanvasTexture(c);
        earthMat.map = fb;
        earthMat.needsUpdate = true;
        earthTex = fb;
      }
    );

    loader.load(URLS.spec, function (spec) {
      earthMat.specularMap = spec;
      earthMat.specular = new THREE.Color(0x6b8aae);
      earthMat.needsUpdate = true;
    });

    loader.load(URLS.bump, function (bump) {
      earthMat.bumpMap = bump;
      earthMat.bumpScale = 0.022;
      earthMat.needsUpdate = true;
    });

    // ---------- clouds ----------
    const cloudGeo = new THREE.SphereGeometry(1.515, 96, 96);
    const cloudMat = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(clouds);
    loader.load(URLS.clouds, function (cTex) {
      if (THREE.SRGBColorSpace) cTex.colorSpace = THREE.SRGBColorSpace;
      cloudMat.map = cTex;
      cloudMat.alphaMap = cTex;
      cloudMat.needsUpdate = true;
    });

    // ---------- night side city lights ----------
    const nightGeo = new THREE.SphereGeometry(1.502, 96, 96);
    const nightMat = new THREE.MeshBasicMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85,
    });
    const nightSide = new THREE.Mesh(nightGeo, nightMat);
    earthGroup.add(nightSide);
    loader.load(URLS.night, function (nTex) {
      if (THREE.SRGBColorSpace) nTex.colorSpace = THREE.SRGBColorSpace;
      nightMat.map = nTex;
      nightMat.needsUpdate = true;
    });

    // ---------- atmosphere ----------
    const atmGeo = new THREE.SphereGeometry(1.62, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      vertexShader:
        'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal);' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vN; void main(){' +
        ' float i = pow(0.78 - dot(vN, vec3(0,0,1.0)), 2.4);' +
        ' vec3 col = mix(vec3(0.35,0.62,1.0), vec3(0.55,0.78,1.0), i);' +
        ' gl_FragColor = vec4(col, 1.0) * i; }',
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    earthGroup.add(new THREE.Mesh(atmGeo, atmMat));

    // ---------- lights ----------
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(5, 2, 4);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x1a2842, 0.55));

    // ---------- pins ----------
    const pinGroup = new THREE.Group();
    earthGroup.add(pinGroup);

    function latLngToVec3(lat, lng, r) {
      r = r || 1.51;
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lng + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
         r * Math.cos(phi),
         r * Math.sin(phi) * Math.sin(theta)
      );
    }

    pins.forEach(function (p) {
      const v = latLngToVec3(p.lat, p.lng, 1.51);
      const color = new THREE.Color(p.color || '#52BAFF');
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 12),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4 })
      );
      halo.position.copy(v); pinGroup.add(halo);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 12, 12),
        new THREE.MeshBasicMaterial({ color: color })
      );
      dot.position.copy(v); pinGroup.add(dot);
    });

    // ---------- drag controls ----------
    let isDown = false, lx = 0, ly = 0;
    let rotY = 0, rotX = 0.2;
    renderer.domElement.style.cursor = 'grab';

    function onDown(e) {
      isDown = true; lx = e.clientX; ly = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    }
    function onUp() {
      isDown = false;
      renderer.domElement.style.cursor = 'grab';
    }
    function onMove(e) {
      if (!isDown) return;
      rotY += (e.clientX - lx) * 0.005;
      rotX += (e.clientY - ly) * 0.005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      lx = e.clientX; ly = e.clientY;
    }
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);

    // ---------- loop ----------
    let raf = 0, alive = true;
    function tick() {
      if (!alive) return;
      if (autoRotate && !isDown) rotY += 0.0015;
      earthGroup.rotation.y = rotY;
      earthGroup.rotation.x = rotX;
      clouds.rotation.y = rotY * 1.08;
      clouds.rotation.x = rotX;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    tick();

    // ---------- responsive ----------
    function onResize() {
      const w = el.clientWidth || size;
      const h = el.clientHeight || size;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);
    onResize();

    return {
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        renderer.domElement.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        if (earthTex && earthTex.dispose) earthTex.dispose();
        if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      }
    };
  }

  window.PathReelGlobe = { mount: mount };
})();

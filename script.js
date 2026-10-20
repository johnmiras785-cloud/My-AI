import * as THREE from
'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

import {
  HandLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

const $ = id => document.getElementById(id);
const video = $('camera');
const canvas = $('scene');

let tracker = null;
let stream = null;
let running = false;
let lastVideoTime = -1;
let lastShot = 0;
let power = 100;
let armorOn = true;
let flying = false;
let rotating = true;
let handPoint = null;
let previousFist = false;
let audioContext = null;
let toastTimer;
let frameCount = 0;
let fpsTime = performance.now();

const scene = new THREE.Scene();

const cam3d = new THREE.PerspectiveCamera(
  42, innerWidth / innerHeight, .1, 100
);
cam3d.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true
});

renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

scene.add(new THREE.HemisphereLight(
  0xa5edff, 0x172030, 2.2
));

const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(3, 5, 8);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x00dfff, 30, 18);
rimLight.position.set(-4, 2, 3);
scene.add(rimLight);

const armor = new THREE.Group();
scene.add(armor);

const body = new THREE.Group();
armor.add(body);

function mat(
  color,
  metalness = .7,
  roughness = .28,
  emissive = 0x000000
) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive,
    emissiveIntensity: 1
  });
}

const red = mat(0xa81728, .82, .25, 0x210006);
const red2 = mat(0xe52d3b, .7, .24, 0x340006);
const gold = mat(0xffc65a, .8, .23, 0x281400);
const dark = mat(0x172c3c, .85, .3, 0x00101c);
const joint = mat(0x344a5b, .75, .35);

const glow = new THREE.MeshBasicMaterial({
  color: 0x52f4ff,
  toneMapped: false
});

const coreMat = new THREE.MeshBasicMaterial({
  color: 0x47f7ff,
  toneMapped: false
});

const parts = [];
const glowParts = [];
const arms = [];
const forearms = [];
const palms = [];

function mesh(g, m, p, x, y, z, sx=1, sy=1, sz=1) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  p.add(o);
  parts.push(o);
  return o;
}

function ell(m, p, x, y, z, sx, sy, sz) {
  return mesh(
    new THREE.SphereGeometry(1, 24, 16),
    m, p, x, y, z, sx, sy, sz
  );
}

function box(m, p, x, y, z, sx, sy, sz) {
  return mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    m, p, x, y, z
  );
}

function torus(m, p, x, y, z, r, t) {
  return mesh(
    new THREE.TorusGeometry(r, t, 10, 48),
    m, p, x, y, z
  );
}

function glowTorus(p, x, y, z, r, t) {
  const o = torus(glow, p, x, y, z, r, t);
  glowParts.push(o);
  return o;
}

function glowSphere(p, x, y, z, sx, sy, sz) {
  const o = ell(coreMat, p, x, y, z, sx, sy, sz);
  glowParts.push(o);
  return o;
}

// HELMET
ell(red, body, 0, 1.58, 0, .56, .64, .46);
ell(gold, body, 0, 1.61, .38, .44, .42, .12);
ell(red2, body, 0, 1.34, .43, .30, .18, .10);
box(dark, body, 0, 1.28, .51, .24, .06, .035);
box(gold, body, -.42, 1.65, .34, .12, .28, .12);
box(gold, body, .42, 1.65, .34, .12, .28, .12);

box(glow, body, -.205, 1.72, .50, .23, .05, .025);
box(glow, body, .205, 1.72, .50, .23, .05, .025);

// NECK AND CHEST
mesh(
  new THREE.CylinderGeometry(.23, .27, .3, 20),
  dark, body, 0, .97, 0
);

ell(red, body, 0, .43, 0, .91, .69, .47);
ell(red2, body, 0, .69, .23, .75, .34, .29);

const chestPlate = mesh(
  new THREE.CylinderGeometry(.72, .58, .20, 6),
  gold, body, 0, .57, .33
);
chestPlate.rotation.z = Math.PI;

ell(dark, body, 0, .47, .47, .35, .34, .13);
glowTorus(body, 0, .47, .59, .25, .045);
glowTorus(body, 0, .47, .62, .18, .018);
glowSphere(body, 0, .47, .62, .14, .14, .035);

for (const s of [-1, 1]) {
  box(gold, body, s*.49, .47, .47, .19, .09, .04);
  box(dark, body, s*.49, .30, .47, .16, .07, .04);
}

// SHOULDERS, ARMS AND PALM REPULSORS
for (const s of [-1, 1]) {
  const arm = new THREE.Group();
  arm.position.set(s*.88, .66, 0);
  body.add(arm);

  ell(red, arm, 0, 0, 0, .35, .35, .35);
  ell(gold, arm, 0, -.04, .24, .26, .21, .15);

  mesh(
    new THREE.CylinderGeometry(.20, .22, .34, 20),
    dark, arm, 0, -.38, .02
  );

  ell(red2, arm, 0, -.59, .03, .22, .28, .23);
  ell(joint, arm, 0, -.82, .03, .19, .17, .19);

  const fore = new THREE.Group();
  fore.position.set(0, -.85, .02);
  arm.add(fore);

  ell(red, fore, 0, -.23, 0, .24, .33, .24);
  ell(gold, fore, 0, -.25, .17, .19, .23, .11);

  mesh(
    new THREE.CylinderGeometry(.16, .19, .19, 18),
    dark, fore, 0, -.49, 0
  );

  const palm = new THREE.Group();
  palm.position.set(0, -.59, .03);
  fore.add(palm);

  ell(gold, palm, 0, 0, .04, .18, .15, .10);
  ell(red2, palm, 0, -.11, .08, .15, .09, .09);

  for (let i = 0; i < 4; i++) {
    ell(
      red2, palm,
      (i - 1.5) * .08, -.22, .08,
      .032, .11, .04
    );
  }

  ell(gold, palm, s*.19, -.03, .04, .06, .11, .06);
  glowTorus(palm, 0, -.07, .16, .105, .016);
  glowSphere(palm, 0, -.07, .17, .06, .06, .025);
  glowSphere(fore, 0, -.48, .18, .09, .045, .02);

  arms.push(arm);
  forearms.push(fore);
  palms.push(palm);
}

// WAIST
ell(dark, body, 0, -.30, 0, .62, .22, .38);
ell(red, body, 0, -.48, .02, .52, .23, .33);

for (const s of [-1, 1]) {
  ell(gold, body, s*.35, -.47, .29, .12, .13, .06);
}

// HOLOGRAM FLOOR
const hologram = new THREE.Group();
scene.add(hologram);

const holoMat = new THREE.MeshBasicMaterial({
  color: 0x00cfff,
  transparent: true,
  opacity: .4
});

for (const r of [1.1, 1.45]) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, .008, 8, 80),
    holoMat
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1.95;
  hologram.add(ring);
}

// HAND TARGET
const target = new THREE.Group();
scene.add(target);

target.add(new THREE.Mesh(
  new THREE.TorusGeometry(.18, .012, 8, 32),
  glow
));

target.add(new THREE.Mesh(
  new THREE.SphereGeometry(.055, 12, 8),
  coreMat
));

const effects = new THREE.Group();
scene.add(effects);
const particles = [];

function toast(message) {
  $('toast').textContent = message;
  $('toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $('toast').style.display = 'none';
  }, 1700);
}

// SOUND EFFECTS
function playSound(freq=300, duration=.15) {
  if (!$('sound').checked) return;

  try {
    audioContext ||= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(
      freq, audioContext.currentTime
    );
    osc.frequency.exponentialRampToValueAtTime(
      45, audioContext.currentTime + duration
    );

    gain.gain.setValueAtTime(.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      .001, audioContext.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + duration);
  } catch (e) {}
}

// REPULSOR BLAST
function blast(x, y, z=1.1) {
  if (power <= 0) {
    toast('LOW POWER — CHARGE FIRST');
    return;
  }

  const g = new THREE.Group();
  g.position.set(x, y, z);
  effects.add(g);

  const c = new THREE.Mesh(
    new THREE.SphereGeometry(.12, 16, 12),
    new THREE.MeshBasicMaterial({color:0xffffff})
  );

  const h = new THREE.Mesh(
    new THREE.TorusGeometry(.17, .025, 8, 28),
    new THREE.MeshBasicMaterial({
      color:0x52f4ff,
      transparent:true
    })
  );

  const b = new THREE.Mesh(
    new THREE.CylinderGeometry(.025,.15,1.0,12,1,true),
    new THREE.MeshBasicMaterial({
      color:0x40ddff,
      transparent:true,
      opacity:.85,
      blending:THREE.AdditiveBlending,
      depthWrite:false
    })
  );

  b.position.y = -.48;
  g.add(c, h, b);

  const l = new THREE.PointLight(0x00dfff, 7, 4);
  g.add(l);

  particles.push({
    g, c, h, b, l,
    born:performance.now(),
    life:480
  });

  power = Math.max(0, power - 4);
  playSound(320, .2);
}

function updateEffects(now) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const a = (now - p.born) / p.life;

    if (a >= 1) {
      effects.remove(p.g);

      p.g.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });

      particles.splice(i, 1);
      continue;
    }

    const s = .5 + a * 2.5;
    p.c.scale.setScalar(s);
    p.h.scale.setScalar(s);
    p.h.rotation.z += .12;
    p.b.scale.y = 1 - a * .7;
    p.l.intensity = 7 * (1 - a);

    p.g.children.forEach(o => {
      if (o.material && 'opacity' in o.material) {
        o.material.opacity = 1 - a;
      }
    });
  }
}

function setStatus(hand, reactor) {
  $('gesture').textContent = hand;
  $('reactor').textContent = reactor;
}

function extended(lm, tip, pip) {
  return lm[tip].y < lm[pip].y - .018;
}

// HAND TRACKING
function trackHands() {
  if (
    !tracker ||
    video.readyState < 2 ||
    video.currentTime === lastVideoTime
  ) return;

  lastVideoTime = video.currentTime;

  const res = tracker.detectForVideo(
    video, performance.now()
  );

  if (!res.landmarks || !res.landmarks.length) {
    setStatus('NO HAND', 'STANDBY');
    handPoint = null;
    previousFist = false;
    return;
  }

  const lm = res.landmarks[0];

  const count = [
    extended(lm,8,6),
    extended(lm,12,10),
    extended(lm,16,14),
    extended(lm,20,18)
  ].filter(Boolean).length;

  const open = count >= 3;
  const fist = count === 0;
  const sens = Number($('sensitivity').value) / 100;

  handPoint = {
    x: (0.5 - lm[9].x) * 5.8 * sens,
    y: (0.5 - lm[9].y) * 4.5 * sens
  };

  target.position.set(handPoint.x, handPoint.y, 1.5);
  target.visible = $('showHands').checked;

  setStatus(
    open ? 'OPEN PALM' : fist ? 'FIST' : 'GESTURE ' + count,
    open ? 'CHARGING' : fist ? 'READY' : 'STANDBY'
  );

  if (open) {
    power = Math.min(100, power + .22);
  }

  // Fire once when the hand changes into a fist
  if (
    fist &&
    !previousFist &&
    performance.now() - lastShot > 650
  ) {
    blast(handPoint.x, handPoint.y, 1.3);
    lastShot = performance.now();
  }

  previousFist = fist;
}

// START CAMERA / DEMO
async function activate(useCamera=true) {
  $('begin').disabled = true;
  $('error').textContent = 'Starting system...';

  try {
    if (useCamera) {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera unavailable. Open your HTTPS GitHub Pages link in Chrome.'
        );
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: {ideal:640},
          height: {ideal:480}
        }
      });

      video.srcObject = stream;
      await video.play();

      $('camstatus').textContent = 'ACTIVE';
      $('sys').textContent = 'LOADING AI';
      $('hint').textContent = 'LOADING HAND TRACKING MODEL...';

      const files = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      const modelOptions = {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      };

      try {
        tracker = await HandLandmarker.createFromOptions(
          files, modelOptions
        );
      } catch (gpuError) {
        modelOptions.baseOptions.delegate = 'CPU';
        tracker = await HandLandmarker.createFromOptions(
          files, modelOptions
        );
      }
    } else {
      $('camstatus').textContent = 'DEMO';
      $('hint').textContent = 'DEMO MODE • USE BUTTONS';
    }

    running = true;
    $('sys').textContent = 'ONLINE';
    $('start').style.display = 'none';

    if (useCamera) {
      $('hint').textContent = 'OPEN PALM: CHARGE • FIST: FIRE';
    }

    playSound(480, .18);
    animate();

  } catch (e) {
    $('error').textContent =
      'Could not start: ' + e.message +
      ' Check permission and internet, then reload.';
    $('begin').disabled = false;
    $('sys').textContent = 'ERROR';
  }
}

$('begin').addEventListener('click', () => activate(true));
$('demo').addEventListener('click', () => activate(false));

// BUTTON CONTROLS
$('fly').onclick = () => {
  flying = !flying;
  $('fly').textContent = flying ? '✦ LAND' : '✦ FLIGHT';
  $('mode').textContent = flying ? 'FLIGHT' : 'HOLOGRAM';
  playSound(240, .12);
};

$('fire').onclick = () => {
  const x = handPoint ? handPoint.x : (Math.random() - .5) * 1.5;
  const y = handPoint ? handPoint.y : .2;
  blast(x, y, 1.3);
};

$('charge').onclick = () => {
  power = Math.min(100, power + 20);
  toast('REACTOR CHARGED');
  playSound(550, .2);
};

$('rotate').onclick = () => {
  rotating = !rotating;
  $('rotate').textContent =
    '⟳ ROTATE: ' + (rotating ? 'ON' : 'OFF');
};

$('hide').onclick = () => {
  armorOn = !armorOn;
  armor.visible = armorOn;
  $('hide').textContent =
    'ARMOR: ' + (armorOn ? 'ON' : 'OFF');
};

$('settingsBtn').onclick = () => {
  $('settings').style.display = 'block';
};

$('closeSettings').onclick = () => {
  $('settings').style.display = 'none';
};

$('recenter').onclick = () => {
  armor.rotation.set(0, 0, 0);
  armor.position.set(0, 0, 0);
  toast('ARMOR RECENTERED');
};

$('stop').onclick = () => {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }

  stream = null;
  video.srcObject = null;
  tracker = null;
  running = false;

  $('camstatus').textContent = 'OFF';
  $('sys').textContent = 'STOPPED';
  $('start').style.display = 'flex';
  $('begin').disabled = false;
  $('error').textContent =
    'Camera stopped. Activate again to restart.';
};

// SETTINGS
$('size').oninput = e => {
  const v = Number(e.target.value);
  $('sizeVal').textContent = v + '%';
  armor.scale.setScalar(v / 100);
};

$('glow').oninput = e => {
  const v = Number(e.target.value) / 100;
  $('glowVal').textContent = Math.round(v * 100) + '%';

  glowParts.forEach(o => {
    if (o.material) o.material.opacity = Math.min(1, v);
  });

  rimLight.intensity = 30 * v;
};

$('sensitivity').oninput = e => {
  $('sensVal').textContent = e.target.value + '%';
};

$('mirror').onchange = e => {
  video.style.transform =
    e.target.checked ? 'scaleX(-1)' : 'none';
};

$('wireframe').onchange = e => {
  [red, red2, gold, dark, joint].forEach(m => {
    m.wireframe = e.target.checked;
  });
};

$('showHands').onchange = e => {
  target.visible = e.target.checked;
};

$('sound').onchange = () => {
  if ($('sound').checked) playSound(500, .08);
};

// MAIN ANIMATION
function animate() {
  if (!running) return;

  requestAnimationFrame(animate);

  const now = performance.now();
  const t = now * .001;

  if (tracker) trackHands();

  if (rotating) {
    armor.rotation.y = Math.sin(t * .45) * .20;
  }

  armor.position.y = flying
    ? Math.sin(t * 2.8) * .22 + .28
    : Math.sin(t * 1.5) * .025;

  hologram.rotation.y = t * .18;

  reactorPartsAnimation(t);
  updateEffects(now);

  if (handPoint && tracker) {
    targetRingRotation(t);
    target.scale.setScalar(1 + Math.sin(t * 8) * .08);
  } else {
    target.visible = false;
  }

  $('power').textContent = Math.round(power) + '%';
  $('powerfill').style.width = power + '%';

  frameCount++;

  if (now - fpsTime > 1000) {
    $('fps').textContent = frameCount;
    frameCount = 0;
    fpsTime = now;
  }

  renderer.render(scene, cam3d);
}

function targetRingRotation(t) {
  target.children[0].rotation.z = t * 1.8;
}

function reactorPartsAnimation(t) {
  glowParts.forEach((o, i) => {
    if (o.material && 'opacity' in o.material) {
      o.material.opacity =
        .55 + .4 * (.5 + .5 * Math.sin(t * 3 + i));
    }
  });
}

function resize() {
  cam3d.aspect = innerWidth / innerHeight;
  cam3d.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

addEventListener('resize', resize);
</script>

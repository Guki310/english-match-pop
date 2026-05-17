import * as THREE from "three";
import "./styles.css";

const root = document.querySelector("#game");
const enemyBars = document.querySelector("#enemy-bars");
const menu = document.querySelector("#menu");
const startButton = document.querySelector("#start");
const toast = document.querySelector("#toast");
const healthEl = document.querySelector("#health");
const armorEl = document.querySelector("#armor");
const ammoEl = document.querySelector("#ammo");
const buildsEl = document.querySelector("#builds");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8c8);
scene.fog = new THREE.Fog(0x9fb8c8, 42, 118);

const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 1.7, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const aimDirection = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempBox = new THREE.Box3();

const player = {
  health: 100,
  armor: 50,
  speed: 8.6,
  sprint: 1.45,
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  radius: 0.45,
  height: 1.7,
  ammo: 30,
  reserve: 90,
  magazine: 30,
  builds: 12,
  alive: true,
  lastShot: 0,
  reloading: false,
};

const keys = new Set();
const colliders = [];
const enemies = [];
const buildables = [];
const decals = [];
let locked = false;
let toastTimer = 0;

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x5c6f5a, roughness: 0.92 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x8f9aa3, roughness: 0.84 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xc66b3d, roughness: 0.76 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x2f837c, roughness: 0.72 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xd8b548, roughness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x242933, roughness: 0.8 }),
  enemy: new THREE.MeshStandardMaterial({ color: 0x9b2f43, roughness: 0.66 }),
  enemyHead: new THREE.MeshStandardMaterial({ color: 0xe3b596, roughness: 0.58 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x8fd3ff,
    roughness: 0.2,
    metalness: 0.12,
    transparent: true,
    opacity: 0.42,
  }),
  muzzle: new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
};

setupLighting();
createArena();
createWeapon();
spawnEnemy(new THREE.Vector3(-14, 0, -13));
spawnEnemy(new THREE.Vector3(13, 0, -16));
spawnEnemy(new THREE.Vector3(0, 0, -28));
showToast("准备就绪");
updateHud();

startButton.addEventListener("click", () => {
  enterGame();
});

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === renderer.domElement;
  menu.classList.toggle("is-hidden", locked);
});

document.addEventListener("mousemove", (event) => {
  if (!locked || !player.alive) return;
  player.yaw -= event.movementX * 0.0023;
  player.pitch -= event.movementY * 0.0023;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.35, 1.35);
});

document.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyR") reload();
  if (event.code === "KeyE") spawnEnemy(getForwardPoint(16));
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.addEventListener("mousedown", (event) => {
  if (!locked || !player.alive) return;
  if (event.button === 0) shoot();
  if (event.button === 2) placeCover();
});

document.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function enterGame() {
  const lockRequest = renderer.domElement.requestPointerLock?.();
  if (lockRequest?.catch) {
    lockRequest.catch(() => {
      locked = true;
      menu.classList.add("is-hidden");
      showToast("战局开始");
    });
    return;
  }

  locked = true;
  menu.classList.add("is-hidden");
  showToast("战局开始");
}

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.04);
  updatePlayer(delta);
  updateEnemies(delta);
  updateDecals(delta);
  updateEnemyBars();
  renderer.render(scene, camera);
});

function setupLighting() {
  const hemi = new THREE.HemisphereLight(0xeaf7ff, 0x3b4639, 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(18, 34, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  scene.add(sun);
}

function createArena() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(118, 118), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  addBox("wall-n", 0, 2.4, -44, 92, 4.8, 2.2, materials.concrete);
  addBox("wall-s", 0, 2.4, 18, 92, 4.8, 2.2, materials.concrete);
  addBox("wall-w", -28, 2.4, -13, 2.2, 4.8, 64, materials.concrete);
  addBox("wall-e", 28, 2.4, -13, 2.2, 4.8, 64, materials.concrete);

  addBox("warehouse", -19, 3, -31, 10, 6, 9, materials.dark);
  addBox("container-a", -10, 1.35, -12, 7.5, 2.7, 3, materials.orange);
  addBox("container-b", 11, 1.35, -9, 3.2, 2.7, 9, materials.teal);
  addBox("tower", 18, 4, -27, 5, 8, 5, materials.yellow);
  addBox("bridge", 11, 5.4, -24, 18, 1.4, 3.4, materials.concrete);
  addBox("cover-1", -3, 1, -25, 3, 2, 3, materials.concrete);
  addBox("cover-2", 7, 0.9, -20, 4, 1.8, 2.4, materials.concrete);
  addBox("cover-3", -17, 0.9, -4, 4.5, 1.8, 2.8, materials.yellow);

  for (let i = 0; i < 16; i += 1) {
    const x = -22 + (i % 8) * 6.3;
    const z = -38 + Math.floor(i / 8) * 10;
    const height = 0.4 + ((i * 37) % 6) * 0.18;
    addBox(`crate-${i}`, x, height / 2, z, 2.2, height, 2.2, i % 2 ? materials.orange : materials.teal);
  }

  const glass = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 0.18), materials.glass);
  glass.position.set(0, 1.7, -7);
  glass.castShadow = true;
  glass.receiveShadow = true;
  scene.add(glass);
  glass.userData.health = 70;
  glass.userData.destructible = true;
  colliders.push({ mesh: glass, box: new THREE.Box3().setFromObject(glass), dynamic: false });
}

function addBox(name, x, y, z, width, height, depth, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({ mesh, box: new THREE.Box3().setFromObject(mesh), dynamic: false });
  return mesh;
}

function createWeapon() {
  const weapon = new THREE.Group();
  weapon.name = "weapon";

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.78), materials.dark);
  body.position.set(0.26, -0.22, -0.62);
  weapon.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.54, 16), materials.concrete);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.26, -0.22, -1.18);
  weapon.add(barrel);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.18), materials.orange);
  grip.rotation.x = -0.28;
  grip.position.set(0.22, -0.48, -0.42);
  weapon.add(grip);

  camera.add(weapon);
  scene.add(camera);
}

function spawnEnemy(position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 8, 16), materials.enemy);
  torso.position.y = 1.1;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), materials.enemyHead);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.58, 0.18), materials.dark);
  pack.position.set(0, 1.22, 0.42);
  pack.castShadow = true;
  group.add(pack);

  scene.add(group);

  const bar = document.createElement("div");
  bar.className = "enemy-bar";
  const fill = document.createElement("div");
  fill.className = "enemy-bar__fill";
  bar.appendChild(fill);
  enemyBars.appendChild(bar);

  enemies.push({
    group,
    torso,
    head,
    health: 100,
    maxHealth: 100,
    speed: 2.1 + Math.random() * 0.45,
    attackTimer: Math.random(),
    hurtTimer: 0,
    bar,
    fill,
    alive: true,
  });
  showToast("目标已加入战场");
}

function updatePlayer(delta) {
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  if (!locked || !player.alive) return;

  const input = new THREE.Vector3(
    Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    0,
    Number(keys.has("KeyS")) - Number(keys.has("KeyW")),
  );

  if (input.lengthSq() > 0) input.normalize();

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const desired = new THREE.Vector3()
    .addScaledVector(right, input.x)
    .addScaledVector(forward, -input.z);

  const speed = player.speed * (keys.has("ShiftLeft") ? player.sprint : 1);
  player.velocity.x = THREE.MathUtils.damp(player.velocity.x, desired.x * speed, 12, delta);
  player.velocity.z = THREE.MathUtils.damp(player.velocity.z, desired.z * speed, 12, delta);

  const next = camera.position.clone();
  next.x += player.velocity.x * delta;
  resolveAxis(next, "x");
  next.z += player.velocity.z * delta;
  resolveAxis(next, "z");
  next.y = player.height;
  camera.position.copy(next);
}

function resolveAxis(next, axis) {
  const playerBox = new THREE.Box3(
    new THREE.Vector3(next.x - player.radius, 0, next.z - player.radius),
    new THREE.Vector3(next.x + player.radius, player.height, next.z + player.radius),
  );

  for (const collider of colliders) {
    if (collider.dynamic) collider.box.setFromObject(collider.mesh);
    if (!playerBox.intersectsBox(collider.box)) continue;
    if (axis === "x") {
      next.x = camera.position.x;
      player.velocity.x = 0;
    } else {
      next.z = camera.position.z;
      player.velocity.z = 0;
    }
    break;
  }
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    enemy.hurtTimer = Math.max(0, enemy.hurtTimer - delta);
    enemy.group.children.forEach((child) => {
      if (child.material?.emissive) child.material.emissive.setHex(enemy.hurtTimer > 0 ? 0x5b1820 : 0x000000);
    });

    const toPlayer = new THREE.Vector3().subVectors(camera.position, enemy.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();

    if (distance > 2.2) {
      toPlayer.normalize();
      const next = enemy.group.position.clone().addScaledVector(toPlayer, enemy.speed * delta);
      if (!isBlocked(next, 0.45)) enemy.group.position.copy(next);
    }

    enemy.group.lookAt(camera.position.x, enemy.group.position.y, camera.position.z);
    enemy.attackTimer -= delta;
    if (distance < 3.0 && enemy.attackTimer <= 0) {
      damagePlayer(8 + Math.round(Math.random() * 4));
      enemy.attackTimer = 0.72;
    }
  }
}

function isBlocked(position, radius) {
  const box = new THREE.Box3(
    new THREE.Vector3(position.x - radius, 0, position.z - radius),
    new THREE.Vector3(position.x + radius, 1.95, position.z + radius),
  );
  for (const collider of colliders) {
    tempBox.copy(collider.box);
    if (collider.dynamic) tempBox.setFromObject(collider.mesh);
    if (box.intersectsBox(tempBox)) return true;
  }
  return false;
}

function shoot() {
  const now = performance.now();
  if (now - player.lastShot < 110 || player.reloading) return;
  if (player.ammo <= 0) {
    reload();
    return;
  }

  player.lastShot = now;
  player.ammo -= 1;
  updateHud();
  flashMuzzle();

  camera.getWorldDirection(aimDirection);
  raycaster.set(camera.position, aimDirection);
  raycaster.far = 90;

  const targetMeshes = [];
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    targetMeshes.push(enemy.torso, enemy.head);
  }
  for (const buildable of buildables) targetMeshes.push(buildable.mesh);
  for (const collider of colliders) {
    if (collider.mesh.userData.destructible) targetMeshes.push(collider.mesh);
  }

  const hits = raycaster.intersectObjects(targetMeshes, false);
  if (hits.length === 0) {
    addImpact(camera.position.clone().addScaledVector(aimDirection, 34), 0xffffff);
    return;
  }

  const hit = hits[0];
  const enemy = enemies.find((entry) => entry.torso === hit.object || entry.head === hit.object);
  if (enemy) {
    const damage = hit.object === enemy.head ? 52 : 28;
    enemy.health = Math.max(0, enemy.health - damage);
    enemy.hurtTimer = 0.12;
    addImpact(hit.point, hit.object === enemy.head ? 0xf2c14e : 0xff6b6b);
    if (enemy.health <= 0) defeatEnemy(enemy);
    return;
  }

  const buildable = buildables.find((entry) => entry.mesh === hit.object);
  if (buildable) {
    buildable.health -= 35;
    addImpact(hit.point, 0xe8edf2);
    if (buildable.health <= 0) removeBuildable(buildable);
    return;
  }

  if (hit.object.userData.destructible) {
    hit.object.userData.health -= 35;
    addImpact(hit.point, 0x8fd3ff);
    if (hit.object.userData.health <= 0) {
      colliders.splice(
        colliders.findIndex((entry) => entry.mesh === hit.object),
        1,
      );
      scene.remove(hit.object);
      showToast("屏障已击碎");
    }
  }
}

function reload() {
  if (player.reloading || player.ammo === player.magazine || player.reserve <= 0) return;
  player.reloading = true;
  showToast("换弹中");
  setTimeout(() => {
    const needed = player.magazine - player.ammo;
    const loaded = Math.min(needed, player.reserve);
    player.ammo += loaded;
    player.reserve -= loaded;
    player.reloading = false;
    updateHud();
  }, 720);
}

function placeCover() {
  if (player.builds <= 0) {
    showToast("沙盒材料不足");
    return;
  }

  const point = getForwardPoint(5.5);
  point.y = 1.05;
  if (isBlocked(point, 1.25)) {
    showToast("这里放不下");
    return;
  }

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 0.62), materials.concrete.clone());
  mesh.position.copy(point);
  mesh.rotation.y = player.yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const collider = { mesh, box: new THREE.Box3().setFromObject(mesh), dynamic: true };
  colliders.push(collider);
  buildables.push({ mesh, collider, health: 90 });
  player.builds -= 1;
  updateHud();
  showToast("掩体已放置");
}

function removeBuildable(buildable) {
  scene.remove(buildable.mesh);
  colliders.splice(colliders.indexOf(buildable.collider), 1);
  buildables.splice(buildables.indexOf(buildable), 1);
  showToast("掩体已破坏");
}

function defeatEnemy(enemy) {
  enemy.alive = false;
  enemy.bar.remove();
  scene.remove(enemy.group);
  showToast("目标清除");
  setTimeout(() => spawnEnemy(randomSpawn()), 1200);
}

function damagePlayer(amount) {
  if (!player.alive) return;
  const armorDamage = Math.min(player.armor, Math.ceil(amount * 0.55));
  player.armor -= armorDamage;
  player.health = Math.max(0, player.health - (amount - armorDamage));
  updateHud();
  if (player.health <= 0) {
    player.alive = false;
    document.exitPointerLock();
    showToast("行动失败");
    setTimeout(resetPlayer, 900);
  }
}

function resetPlayer() {
  player.health = 100;
  player.armor = 50;
  player.alive = true;
  player.ammo = 30;
  player.reserve = 90;
  player.builds = 12;
  camera.position.set(0, player.height, 12);
  player.velocity.set(0, 0, 0);
  updateHud();
  showToast("重新部署");
}

function updateEnemyBars() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    tempVector.setFromMatrixPosition(enemy.group.matrixWorld);
    tempVector.y += 2.55;
    tempVector.project(camera);

    const visible = tempVector.z < 1 && tempVector.x > -1.2 && tempVector.x < 1.2 && tempVector.y > -1.2 && tempVector.y < 1.2;
    enemy.bar.style.display = visible ? "block" : "none";
    if (!visible) continue;

    enemy.bar.style.left = `${(tempVector.x * 0.5 + 0.5) * window.innerWidth}px`;
    enemy.bar.style.top = `${(-tempVector.y * 0.5 + 0.5) * window.innerHeight}px`;
    enemy.fill.style.transform = `scaleX(${enemy.health / enemy.maxHealth})`;
  }
}

function updateDecals(delta) {
  for (let i = decals.length - 1; i >= 0; i -= 1) {
    const decal = decals[i];
    decal.life -= delta;
    decal.mesh.material.opacity = Math.max(0, decal.life / 0.32);
    decal.mesh.scale.multiplyScalar(1 + delta * 2.5);
    if (decal.life <= 0) {
      scene.remove(decal.mesh);
      decals.splice(i, 1);
    }
  }
}

function flashMuzzle() {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), materials.muzzle.clone());
  flash.position.set(0.26, -0.22, -1.48);
  camera.add(flash);
  setTimeout(() => camera.remove(flash), 38);
}

function addImpact(position, color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
  );
  mesh.position.copy(position);
  scene.add(mesh);
  decals.push({ mesh, life: 0.32 });
}

function updateHud() {
  healthEl.textContent = player.health;
  armorEl.textContent = player.armor;
  ammoEl.textContent = `${player.ammo} / ${player.reserve}`;
  buildsEl.textContent = player.builds;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1200);
}

function getForwardPoint(distance) {
  camera.getWorldDirection(aimDirection);
  return camera.position.clone().addScaledVector(aimDirection, distance);
}

function randomSpawn() {
  const points = [
    new THREE.Vector3(-18, 0, -36),
    new THREE.Vector3(20, 0, -34),
    new THREE.Vector3(-21, 0, -9),
    new THREE.Vector3(16, 0, -13),
    new THREE.Vector3(0, 0, -35),
  ];
  return points[Math.floor(Math.random() * points.length)].clone();
}

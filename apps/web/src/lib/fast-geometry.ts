import * as THREE from "three";

// Same results as three's BufferGeometry helpers, but working on the typed
// arrays directly. Three's versions read and write every vertex through
// generic accessors, which made growing a garden cost seconds of CPU on a phone.

const normalMatrix = new THREE.Matrix3();
const identity = new THREE.Matrix3();

// geometry.applyMatrix4(matrix), for position and normal attributes.
export const applyMatrix = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
  const e = matrix.elements;
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const p = position.array as Float32Array;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    p[i] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    p[i + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    p[i + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
  }
  position.needsUpdate = true;

  const normal = geometry.attributes.normal as THREE.BufferAttribute | undefined;
  if (normal) {
    // A pure translation leaves normals alone: skip inverting the matrix.
    const isTranslation = e[0] === 1 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[5] === 1 && e[6] === 0 && e[8] === 0 && e[9] === 0 && e[10] === 1;
    const m = (isTranslation ? identity : normalMatrix.getNormalMatrix(matrix)).elements;
    const n = normal.array as Float32Array;
    for (let i = 0; i < n.length; i += 3) {
      const x = n[i];
      const y = n[i + 1];
      const z = n[i + 2];
      const nx = m[0] * x + m[3] * y + m[6] * z;
      const ny = m[1] * x + m[4] * y + m[7] * z;
      const nz = m[2] * x + m[5] * y + m[8] * z;
      const inverse = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
      n[i] = nx * inverse;
      n[i + 1] = ny * inverse;
      n[i + 2] = nz * inverse;
    }
    normal.needsUpdate = true;
  }

  if (geometry.boundingBox !== null) boundingBox(geometry);
  if (geometry.boundingSphere !== null) boundingSphere(geometry);
  return geometry;
};

// geometry.computeBoundingSphere(): centred on the bounding box, reaching the farthest vertex.
export const boundingSphere = (geometry: THREE.BufferGeometry) => {
  const p = geometry.attributes.position.array as Float32Array;
  const box = new THREE.Box3();
  const previous = geometry.boundingBox;
  geometry.boundingBox = box;
  boundingBox(geometry);
  geometry.boundingBox = previous;
  const center = box.getCenter(new THREE.Vector3());
  let maxRadiusSq = 0;
  for (let i = 0; i < p.length; i += 3) {
    const dx = center.x - p[i];
    const dy = center.y - p[i + 1];
    const dz = center.z - p[i + 2];
    const distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq > maxRadiusSq) maxRadiusSq = distanceSq;
  }
  geometry.boundingSphere ??= new THREE.Sphere();
  geometry.boundingSphere.center.copy(center);
  geometry.boundingSphere.radius = Math.sqrt(maxRadiusSq);
  return geometry.boundingSphere;
};

// geometry.computeBoundingBox()
export const boundingBox = (geometry: THREE.BufferGeometry) => {
  const p = geometry.attributes.position.array as Float32Array;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  geometry.boundingBox ??= new THREE.Box3();
  geometry.boundingBox.min.set(minX, minY, minZ);
  geometry.boundingBox.max.set(maxX, maxY, maxZ);
  return geometry.boundingBox;
};

// geometry.computeVertexNormals() for a non-indexed geometry: each triangle's
// face normal on its three vertices.
export const flatNormals = (geometry: THREE.BufferGeometry) => {
  const p = geometry.attributes.position.array as Float32Array;
  let normal = geometry.attributes.normal as THREE.BufferAttribute | undefined;
  if (!normal || normal.count !== p.length / 3) {
    normal = new THREE.BufferAttribute(new Float32Array(p.length), 3);
    geometry.setAttribute("normal", normal);
  }
  const n = normal.array as Float32Array;
  // Stored as float32 before normalising, like three does.
  const raw = new Float32Array(3);
  for (let i = 0; i < p.length; i += 9) {
    const cbx = p[i + 6] - p[i + 3];
    const cby = p[i + 7] - p[i + 4];
    const cbz = p[i + 8] - p[i + 5];
    const abx = p[i] - p[i + 3];
    const aby = p[i + 1] - p[i + 4];
    const abz = p[i + 2] - p[i + 5];
    raw[0] = cby * abz - cbz * aby;
    raw[1] = cbz * abx - cbx * abz;
    raw[2] = cbx * aby - cby * abx;
    const inverse = 1 / (Math.sqrt(raw[0] * raw[0] + raw[1] * raw[1] + raw[2] * raw[2]) || 1);
    const x = raw[0] * inverse;
    const y = raw[1] * inverse;
    const z = raw[2] * inverse;
    for (let v = 0; v < 9; v += 3) {
      n[i + v] = x;
      n[i + v + 1] = y;
      n[i + v + 2] = z;
    }
  }
  normal.needsUpdate = true;
  return geometry;
};

// geometry.computeVertexNormals() for an indexed geometry: shared vertices
// average the faces around them, for soft curved surfaces.
export const smoothNormals = (geometry: THREE.BufferGeometry) => {
  const index = geometry.index;
  if (!index) return flatNormals(geometry);
  const p = geometry.attributes.position.array as Float32Array;
  let normal = geometry.attributes.normal as THREE.BufferAttribute | undefined;
  if (!normal || normal.count !== p.length / 3) {
    normal = new THREE.BufferAttribute(new Float32Array(p.length), 3);
    geometry.setAttribute("normal", normal);
  }
  const n = normal.array as Float32Array;
  n.fill(0);
  const ids = index.array;
  for (let i = 0; i < index.count; i += 3) {
    const a = ids[i] * 3;
    const b = ids[i + 1] * 3;
    const c = ids[i + 2] * 3;
    const cbx = p[c] - p[b];
    const cby = p[c + 1] - p[b + 1];
    const cbz = p[c + 2] - p[b + 2];
    const abx = p[a] - p[b];
    const aby = p[a + 1] - p[b + 1];
    const abz = p[a + 2] - p[b + 2];
    const x = cby * abz - cbz * aby;
    const y = cbz * abx - cbx * abz;
    const z = cbx * aby - cby * abx;
    n[a] += x;
    n[a + 1] += y;
    n[a + 2] += z;
    n[b] += x;
    n[b + 1] += y;
    n[b + 2] += z;
    n[c] += x;
    n[c + 1] += y;
    n[c + 2] += z;
  }
  for (let i = 0; i < n.length; i += 3) {
    const inverse = 1 / (Math.sqrt(n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]) || 1);
    n[i] *= inverse;
    n[i + 1] *= inverse;
    n[i + 2] *= inverse;
  }
  normal.needsUpdate = true;
  return geometry;
};

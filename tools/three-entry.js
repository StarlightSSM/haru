/* bundled by tools/build-3d.js into src/js/vendor/three-bundle.js (classic script, sets window.THREE) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

window.THREE = THREE;
window.THREE_EXT = { GLTFLoader, VRMLoaderPlugin, VRMUtils };

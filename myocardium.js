import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';

// Global Variables
let renderer, camera, controls, helper, clock, loadedGLB;

// Setup Three.js renderer
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.autoClear = false;
renderer.setClearColor(0xffffff); // Set background to white
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create camera and controls
camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;

// Create two scenes
const glbScene = new THREE.Scene();
glbScene.background = new THREE.Color(0xe5e7e9); 
// Create a local clipping plane
const localPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

// Load GLB model
const loader = new GLTFLoader();
loader.load('https://vsturgess.github.io/3DModels/myocytes_vessels_singlecolor.glb', (glb) => {
    loadedGLB = glb; // Store the loaded model

    // Create a group to center the object
    const modelGroup = new THREE.Group();

    // Scale the model
    glb.scene.scale.set(0.01, 0.01, 0.01);
    glb.scene.rotation.x = Math.PI / 2; // Rotate 90 degrees around the X-axis

    // Compute the bounding box to center the model
    const box = new THREE.Box3().setFromObject(glb.scene);
    const center = box.getCenter(new THREE.Vector3());

    // Set the position to center the model at the origin
    glb.scene.position.sub(center);
    
    // Add the glb.scene to the modelGroup
    modelGroup.add(glb.scene);
    // Add the group to the glbScene
    glbScene.add(modelGroup); 

    // Traverse the loaded model and apply clipping
    glb.scene.traverse((child) => {
        if (child.isMesh) {
            if (child.material.isMeshStandardMaterial) {
                child.material.clippingPlanes = [localPlane];
                child.material.clipShadows = true; // Enable clip shadows if desired
                child.material.needsUpdate = true; // Ensure material updates
            }
        }
    });

    // Add Camera and position to look at center of object
    camera.position.set(6, 3, 6);
    camera.lookAt(center);
    
}, (xhr) => {
    console.log((xhr.loaded / xhr.total * 100) + ' % loaded');
}, (error) => {
    console.error('An error occurred:', error);
});

// Lighting for the GLB scene
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaaaaa);
glbScene.add(hemiLight);

// Axes Helper in the GLB scene
glbScene.add(new THREE.AxesHelper(20));

// View Helper
helper = new ViewHelper(camera, renderer.domElement);
helper.controls = controls;
helper.controls.center = controls.target;

// UI Element for View Helper
const div = document.createElement('div');
div.id = 'viewHelper';
div.style.position = 'absolute';
div.style.right = 0;
div.style.bottom = 0;
div.style.height = '128px';
div.style.width = '128px';
document.body.appendChild(div);
div.addEventListener('pointerup', (event) => helper.handleClick(event));

// GUI for controlling the clipping plane
const gui = new GUI();
const props = {
    localClippingEnabled: true,
    plane: localPlane.constant,
};

// GUI control to enable/disable local clipping
gui.add(props, 'localClippingEnabled').onChange((value) => {
    if (loadedGLB) {
        loadedGLB.scene.traverse((child) => {
            if (child.isMesh && child.material.isMeshStandardMaterial) {
                child.material.clippingPlanes = value ? [localPlane] : [];
                child.material.needsUpdate = true;
            }
        });
    }
});

// GUI control to adjust the clipping plane position
gui.add(props, 'plane', -5, 5).onChange((value) => {
    localPlane.constant = value; // Update the clipping plane position
    if (loadedGLB) {
        loadedGLB.scene.traverse((child) => {
            if (child.isMesh && child.material.isMeshStandardMaterial) {
                child.material.needsUpdate = true;
            }
        });
    }
});

// Clock
clock = new THREE.Clock();

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (helper.animating) helper.update(delta);
    controls.update();

    renderer.clear(); // Clear the renderer

    // Render the GLB scene
    renderer.render(glbScene, camera);
    
    // Render the View Helper
    helper.render(renderer); // Ensure this is rendering after the GLB scene
}

// Enable local clipping in the renderer
renderer.localClippingEnabled = true;
animate();

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';

// Find height of navigation
const navHeight = document.querySelector('.topnav').offsetHeight;

// Global Variables
let renderer, camera, controls, helper, clock, loadedGLB;
let myocytesGLB, vesselsGLB; // Separate variables for each model
let materials = []; // Store materials for color change
let colorChanging = false; // State for color changing
let colorChangeInterval; // Store the interval for color changing

// Setup Three.js renderer
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.autoClear = false;
renderer.setClearColor(0xffffff); // Set background to white
renderer.setSize(window.innerWidth, window.innerHeight-navHeight);
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
const localPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const localPlaneY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const localPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);


// Create GLTFLoader instance
const loader = new GLTFLoader();

// Function to load and add a model to the scene
function loadModel(filePath, onLoadCallback) {
    loader.load(filePath, (gltf) => {
        // Adjust model scale and position
        gltf.scene.scale.set(0.01, 0.01, 0.01);
        gltf.scene.rotation.x = Math.PI / 2; // Rotate 90 degrees around X-axis

        // Compute the bounding box to center the model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.z -= 5;

        // Add clipping planes to meshes
        gltf.scene.traverse((child) => {
            if (child.isMesh && child.material.isMeshStandardMaterial) {
                child.material.clipShadows = true;
                child.material.needsUpdate = true;
            }
        });

        // Add the model to the scene
        glbScene.add(gltf.scene);

        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                if (child.material.isMeshStandardMaterial) {
                    child.material.clippingPlanes = [localPlaneZ];
                    child.material.clipShadows = true; // Enable clip shadows if desired
                    child.material.needsUpdate = true; // Ensure material updates
                }
            }
        });

        // Call the callback to store the model in a global variable
        onLoadCallback(gltf);

        // Set the camera to look at the first loaded model's center
        camera.position.set(6, 3, 6);
        camera.lookAt(center);
    }, (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + ' % loaded');
    }, (error) => {
        console.error('An error occurred while loading:', error);
    });
}

// Load Myocytes GLB model
loadModel('https://vsturgess.github.io/3DModels/myocytes_only.glb', (gltf) => {
    myocytesGLB = gltf; // Store the myocytes model globally
    myocytesGLB.scene.visible = false;
});

// Load Vessels GLB model
loadModel('https://vsturgess.github.io/3DModels/segments_mult_materials.glb', (gltf) => {
    vesselsGLB = gltf; // Store the vessels model globally
    vesselsGLB.scene.visible = true;

    // Extract materials after loading
    extractMaterials(gltf);
});

let factors = [];
// Load factors from CSV
loadFactors('https://vsturgess.github.io/3DModels/HbSat_ENDO_sept22.csv').then(loadedFactors => {
    factors = loadedFactors;
    console.log('Loaded factors:', factors);
});

// Function to extract materials
function extractMaterials(gltf) {
    gltf.scene.traverse((child) => {
        if (child.isMesh && child.material.isMeshStandardMaterial) {
            materials.push(child.material);
        }
    });
}

// Function to start color changing
function startColorChanging() {
    if (factors.length === 0 || materials.length === 0) return; // Ensure factors and materials are loaded

    let step = 0; // Step counter
    const totalTimeSteps = factors[0].length; // Number of time steps

    colorChangeInterval = setInterval(() => {
        step = step % totalTimeSteps; // Loop through time steps

         // Loop through the materials and apply color based on factors
         materials.forEach((material, index) => {
            if (material && material.isMeshStandardMaterial && factors[index]) {
                const factor = factors[index][step]; // Get the factor for this material
                const startColor = new THREE.Color(1, 0, 0); // Red
                const endColor = new THREE.Color(0, 0, 1); // Blue

                // Interpolate between red and blue based on the factor value
                const newColor = interpolateColor(startColor, endColor, factor);
                material.color.copy(newColor); // Set the material's color
            } else {
                console.warn(`Material or factor missing for index: ${index}`);
            }
        });

        step++;
    }, 100); // Change color every 100ms
}

// Function to stop color changing and set materials to black
function stopColorChanging() {
    clearInterval(colorChangeInterval); // Clear the interval
    materials.forEach(material => {
        if (material && material.isMeshStandardMaterial) {
            material.color.set(0x000000); // Set to black
        }
    });
}

// Function to interpolate color based on factor
function interpolateColor(color1, color2, factor) {
    return color1.clone().lerp(color2, factor);
}

// Load factors from CSV and parse into a 2D array
async function loadFactors(filePath) {
    const response = await fetch(filePath);
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');

    // Parse factors into a 2D array (each row is a vessel)
    //const factors = lines.slice(1).map(line => line.split(',').map(parseFloat)); // Skip header and parse each row
    const factors = lines.map(line => line.split(',').map(parseFloat)); // Parse all rows


    return factors;
}

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
gui.domElement.style.position = 'absolute'; // Set position to absolute
gui.domElement.style.top = `${navHeight}px`; // Move GUI down by navHeight
gui.domElement.style.right = '0px'; // Optional: adjust position
document.body.appendChild(gui.domElement); // Append GUI to the body


const modelVisibility = {
    showMyocytes: false, // Initially visible
    showVessels: true,  // Initially visible
};

const ColorChange = {
    startColorChange: () => {
        if (!colorChanging) {
            colorChanging = true;
            startColorChanging();
        } else {
            colorChanging = false;
            stopColorChanging();
        }
    }
};
const props = {
    localClippingEnabled: true,
    plane: localPlaneZ.constant,
};

// GUI control to show/hide myocytes
gui.add(modelVisibility, 'showMyocytes').name('Show Myocytes').onChange((value) => {
    if (myocytesGLB) {
        myocytesGLB.scene.visible = value;
    }
});

// GUI control to show/hide vessels
gui.add(modelVisibility, 'showVessels').name('Show Vessels').onChange((value) => {
    if (vesselsGLB) {
        vesselsGLB.scene.visible = value;
    }
});

// GUI control to enable/disable local clipping
gui.add(props, 'localClippingEnabled').onChange((value) => {
    if (loadedGLB) {
        loadedGLB.scene.traverse((child) => {
            if (child.isMesh && child.material.isMeshStandardMaterial) {
                child.material.clippingPlanes = value ? [localPlaneZ] : [];
                child.material.needsUpdate = true;
            }
        });
    }
});

// GUI control to adjust the clipping plane position
gui.add(props, 'plane', -5, 5).onChange((value) => {
    localPlaneZ.constant = value; // Update the clipping plane position
    if (loadedGLB) {
        loadedGLB.scene.traverse((child) => {
            if (child.isMesh && child.material.isMeshStandardMaterial) {
                child.material.needsUpdate = true;
            }
        });
    }
});

// GUI control to start/stop color changing
gui.add(ColorChange, 'startColorChange').name('Toggle Color Change');

// Try help section
const infoIcon = document.getElementById('info-icon');
const popup = document.getElementById('popup');
const closeButton = document.getElementById('close-popup');

infoIcon.addEventListener('click', () => {
    popup.style.display = popup.style.display === 'none' || popup.style.display === '' ? 'block' : 'none';
});

closeButton.addEventListener('click', () => {
    popup.style.display = 'none';
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

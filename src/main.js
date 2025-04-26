import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BufferGeometry, Vector2, Vector3 } from 'three'; // Added for type hinting if needed, but not strictly required for JS
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { setupUI } from './ui.js'; // *** NEW: Import UI setup ***
import { calculateSlopeData } from './slopeCalculator.js'; // *** NEW: Import slope calculation ***
import { generateGreenShape } from './shapeGenerator.js'; // *** NEW: Import shape generation ***

// --- Scene Setup ---
const scene = new THREE.Scene();

// --- Constants & Globals ---
const greenSize = 10;
const segments = 100;
const vertsWidth = segments + 1;
const vertsDepth = segments + 1;

const params = {
    greenWidth: 10.0, // *** Align default with max and greenSize ***
    greenLength: 10.0, // Initial length
    greenIrregularity: 0.3, // Initial irregularity
    noiseOffset: 0.0, // *** NEW: Add noise offset parameter ***
    shapeNumPoints: 300, // *** INCREASED for smoother outline ***
    falloffRadius: 2.0, // *** CHANGED: Default value updated ***
    gridResolution: 8, // *** NEW: Grid resolution parameter ***
    showSlopeColors: true, // Changed default to true
    showArrows: true, // Changed default to true
    showContours: false, // *** NEW: Contour visibility parameter ***
    arrowSpacing: 5, // Show arrow every N vertices
    arrowLength: 0.3,
    wireframeVisible: true,
    showMarkers: true
};

let slopeGradients = []; // To store gradient vectors
let slopePercentages = []; // *** NEW: Store slope percentages ***
const arrowHelpersGroup = new THREE.Group(); // Group for easy visibility toggle
const arrowHelpers = []; // Array to hold references for updating
const ARROW_COLOR = 0xffffff; // *** Changed arrows to white ***
const ARROW_HEAD_WIDTH_RATIO = 0.3; // Adjust head size relative to length
const ARROW_HEAD_LENGTH_RATIO = 0.4; // Adjust head length relative to length

let currentGreenShapePoints = []; // *** NEW: Store shape outline points ***
const SHAPE_OUTLINE_Y_OFFSET = 0.015; // Offset outline slightly above wireframe

// *** NEW: Hole Placement State ***
let isPlacingHoles = false;
const HOLE_PLACEMENT_VALID_COLOR = new THREE.Color(0x4CAF50); // Green for valid
const HOLE_PLACEMENT_INVALID_COLOR = new THREE.Color(0x808080); // Grey for invalid
let originalColorsBeforePlacement = null; // To store colors before entering mode

// *** NEW: Hole Placement Indicator ***
let holePlacementIndicator = null;
const HOLE_INDICATOR_RADIUS = 0.15; // Adjust size as needed
const HOLE_INDICATOR_COLOR = 0x000000; // *** CHANGED: Black indicator ***
const HOLE_INDICATOR_OPACITY = 0.5;

// *** NEW: Placed Holes Storage ***
const placedHoles = [];
const holesGroup = new THREE.Group(); // Group to hold placed hole markers
scene.add(holesGroup);
const HOLE_MARKER_RADIUS = HOLE_INDICATOR_RADIUS / 2; // *** NEW: Smaller radius for placed holes ***
const HOLE_MARKER_COLOR = 0x000000; // *** CHANGED: Black for placed holes ***

// *** NEW: Constant for control point height offset ***
const CONTROL_POINT_Y_OFFSET = 1; 

// *** NEW: Contour Line Setup ***
const contourGroup = new THREE.Group();
scene.add(contourGroup);
const contourMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    linewidth: 1, // Adjust linewidth as needed
    transparent: false, // No longer needs transparency
    opacity: 1.0 // Full opacity
});
const contourGeometry = new THREE.BufferGeometry();
const contourLines = new THREE.LineSegments(contourGeometry, contourMaterial);
contourGroup.add(contourLines);
contourGroup.position.y = 0.005; // Slightly above the mesh but below wireframe/points

// --- Camera Setup ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 6; // Move camera closer
camera.position.y = 5; // Lower camera slightly
camera.lookAt(scene.position); // Look at the center

// --- Renderer Setup ---
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Improve sharpness on high DPI screens
renderer.setClearColor(0x0C0C0C); // Intermediate dark grey

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Soft white light
scene.add(ambientLight);
// Optional: Add a directional light for subtle highlights
// const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
// directionalLight.position.set(5, 10, 7);
// scene.add(directionalLight);

// --- Green Mesh Setup ---
const greenGeometry = new THREE.PlaneGeometry(greenSize, greenSize, segments, segments);
greenGeometry.rotateX(-Math.PI / 2); // Rotate to be horizontal

// *** NEW: Initialize vertex colors (RGBA) ***
const initialColor = new THREE.Color(0x808080); // Default grey
const initialMeshAlpha = params.showSlopeColors ? 0.5 : 0.0; // Initial alpha for the mesh
const colorsArray = new Float32Array(greenGeometry.attributes.position.count * 4); // Use 4 components (RGBA)
// *** NEW: Initialize Wireframe Alpha Attribute ***
const wireframeAlphaArray = new Float32Array(greenGeometry.attributes.position.count); 

for (let i = 0; i < greenGeometry.attributes.position.count; i++) {
    colorsArray[i * 4] = initialColor.r;
    colorsArray[i * 4 + 1] = initialColor.g;
    colorsArray[i * 4 + 2] = initialColor.b;
    colorsArray[i * 4 + 3] = initialMeshAlpha; // Set initial mesh alpha
    wireframeAlphaArray[i] = 1.0; // Initialize wireframe alpha to fully opaque
}
greenGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 4)); // Use 4 components (RGBA)
// *** NEW: Add the wireframe alpha attribute ***
greenGeometry.setAttribute('wireframeAlpha', new THREE.BufferAttribute(wireframeAlphaArray, 1));

// Store original Y positions (optional but can be useful)
// const originalPositions = Float32Array.from(greenGeometry.attributes.position.array);

// Main material - allow vertex colors for heatmap later
const greenMaterial = new THREE.MeshBasicMaterial({
    // color: 0x808080, // Color is now driven solely by vertex colors
    side: THREE.DoubleSide,
    vertexColors: true, // *** ALWAYS enable vertex colors ***
    transparent: true, // *** Enable transparency ***
    opacity: 1.0,      // *** Set opacity to 1.0, alpha is controlled per-vertex ***
    alphaTest: 0.1     // *** NEW: Discard fragments with low alpha ***
});

const greenMesh = new THREE.Mesh(greenGeometry, greenMaterial);
scene.add(greenMesh);

// Wireframe overlay
// *** REMOVE polygonOffset properties ***
const wireframeMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    linewidth: 10,
    // vertexColors: true, // *** REMOVE: Don't use vertex colors for wireframe ***
    transparent: true,   // *** KEEP: Wireframe needs transparency for fading ***
    alphaTest: 0.1       // *** NEW: Discard fragments with low alpha ***
    // polygonOffset: true,          // REMOVED
    // polygonOffsetFactor: 100,     // REMOVED
    // polygonOffsetUnits: 100       // REMOVED
}); 

// *** NEW: Modify wireframe shader for custom alpha ***
wireframeMaterial.onBeforeCompile = shader => {
    // Add attribute and varying
    shader.vertexShader = 'attribute float wireframeAlpha;\nvarying float vWireframeAlpha;\n' + shader.vertexShader;
    // Pass alpha to fragment shader
    shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\nvWireframeAlpha = wireframeAlpha;' // Assign value here
    );

    // Add varying
    shader.fragmentShader = 'varying float vWireframeAlpha;\n' + shader.fragmentShader;
    // Apply custom alpha
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>', // NEW target
        '#include <color_fragment>\ndiffuseColor.a = vWireframeAlpha;' // NEW logic: Set diffuse alpha
    );
};

const wireframe = new THREE.LineSegments(greenGeometry, wireframeMaterial); // USE greenGeometry
scene.add(wireframe);

// *** NEW: Physically move wireframe slightly below mesh ***
wireframe.position.y = 0.01;
wireframe.visible = params.wireframeVisible; // Set initial visibility

// *** Add Arrow Group to Scene ***
scene.add(arrowHelpersGroup);

// --- Interpolation Helper --- NEW SECTION

/**
 * Bilinearly interpolates the height (Y-value) from the green geometry
 * at a given world-space (x, z) coordinate.
 * @param {number} x World-space X coordinate.
 * @param {number} z World-space Z coordinate.
 * @param {THREE.PlaneGeometry} geometry The green mesh geometry.
 * @param {number} segmentsX Number of segments along X.
 * @param {number} segmentsZ Number of segments along Z.
 * @param {number} sizeX Total size along X.
 * @param {number} sizeZ Total size along Z.
 * @returns {number} Interpolated Y value, or 0 if out of bounds.
 */
function getInterpolatedHeight(x, z, geometry, segmentsX, segmentsZ, sizeX, sizeZ) {
    const positions = geometry.attributes.position;
    const vertsWidth = segmentsX + 1;
    const vertsDepth = segmentsZ + 1;

    // Convert world coords to normalized grid coords (0 to 1)
    const gridX = (x + sizeX / 2) / sizeX;
    const gridZ = (z + sizeZ / 2) / sizeZ; // Z maps to the second dimension of the grid

    // Convert normalized grid coords to vertex indices space
    const col = gridX * segmentsX;
    const row = gridZ * segmentsZ; // Z maps to rows

    // *** START FIX: Clamp column and row indices ***
    // Calculate base indices and clamp them
    let col0 = Math.floor(col);
    let row0 = Math.floor(row);

    col0 = Math.max(0, Math.min(col0, segmentsX - 1)); // Clamp col0 between 0 and segmentsX-1
    row0 = Math.max(0, Math.min(row0, segmentsZ - 1)); // Clamp row0 between 0 and segmentsZ-1

    // Calculate next indices and clamp them
    let col1 = col0 + 1;
    let row1 = row0 + 1;

    col1 = Math.min(col1, segmentsX); // Clamp col1 to segmentsX (max valid index)
    row1 = Math.min(row1, segmentsZ); // Clamp row1 to segmentsZ (max valid index)
    // *** END FIX ***

    // Get interpolation factors (how far between grid lines)
    // Clamp the original col/row values before calculating tx/ty to avoid issues at edges
    const clampedCol = Math.max(0, Math.min(col, segmentsX));
    const clampedRow = Math.max(0, Math.min(row, segmentsZ));
    const tx = clampedCol - col0;
    const ty = clampedRow - row0;
    
    // Get vertex indices 
    const idx00 = row0 * vertsWidth + col0;
    const idx10 = row0 * vertsWidth + col1;
    const idx01 = row1 * vertsWidth + col0;
    const idx11 = row1 * vertsWidth + col1;

    // *** REMOVED redundant check: Indices should now always be valid due to clamping ***
    // if (idx00 >= positions.count || idx10 >= positions.count || idx01 >= positions.count || idx11 >= positions.count) {
    //     // This fallback should ideally not be needed anymore
    //     console.warn("Interpolation index out of bounds despite clamping.");
    //     return positions.getY(Math.min(idx00, positions.count - 1)); // Fallback
    // }

    // Get heights of the 4 corner vertices
    const y00 = positions.getY(idx00);
    const y10 = positions.getY(idx10);
    const y01 = positions.getY(idx01);
    const y11 = positions.getY(idx11);

    // Bilinear interpolation
    const y_interp_row0 = THREE.MathUtils.lerp(y00, y10, tx);
    const y_interp_row1 = THREE.MathUtils.lerp(y01, y11, tx);
    const finalY = THREE.MathUtils.lerp(y_interp_row0, y_interp_row1, ty);

    return finalY;
}

// --- Arrow Helper Functions ---

/**
 * Creates ArrowHelper objects sparsely on the grid.
 */
function createArrowHelpers() {
    arrowHelpersGroup.clear(); // Clear previous arrows if any
    arrowHelpers.length = 0; // Clear the reference array

    const spacing = params.arrowSpacing;
    if (spacing <= 0) return; // Don't create if spacing is invalid

    const headLength = params.arrowLength * ARROW_HEAD_LENGTH_RATIO;
    const headWidth = params.arrowLength * ARROW_HEAD_WIDTH_RATIO;

    for (let row = 0; row < vertsDepth; row += spacing) {
        for (let col = 0; col < vertsWidth; col += spacing) {
            const vertexIndex = row * vertsWidth + col;
            if (vertexIndex >= greenGeometry.attributes.position.count) continue;

            const initialDir = new THREE.Vector3(0, 0, -1); // Default direction
            const initialPos = new THREE.Vector3();
            initialPos.fromBufferAttribute(greenGeometry.attributes.position, vertexIndex);
            initialPos.y += 0.02; // Position slightly above the surface

            const arrow = new THREE.ArrowHelper(
                initialDir.normalize(),
                initialPos,
                params.arrowLength,
                ARROW_COLOR,
                headLength, // Head length
                headWidth // Head width
            );

            arrowHelpersGroup.add(arrow);
            arrowHelpers.push({ arrow: arrow, vertexIndex: vertexIndex });
        }
    }
    updateArrowVisibility(); // Set initial visibility based on params
}

/**
 * Updates position and direction of existing ArrowHelpers.
 */
function updateArrowHelpers() {
    if (!slopeGradients || slopeGradients.length === 0) return;

    const positions = greenGeometry.attributes.position;
    const tempPos = new THREE.Vector3();
    const tempPos2D = new THREE.Vector2();
    const hasValidBoundary = currentGreenShapePoints && currentGreenShapePoints.length >= 3;

    arrowHelpers.forEach(helperData => {
        const { arrow, vertexIndex } = helperData;

        if (vertexIndex >= positions.count || vertexIndex >= slopeGradients.length) {
            arrow.visible = false; // Hide invalid arrows
            return;
        }

        // Get current vertex position
        tempPos.fromBufferAttribute(positions, vertexIndex);
        tempPos2D.set(tempPos.x, tempPos.z);

        const isInside = hasValidBoundary ? isPointInPolygon(tempPos2D, currentGreenShapePoints) : true;

        tempPos.y += 0.02;
        arrow.position.copy(tempPos);

        // Get gradient direction
        const direction = slopeGradients[vertexIndex];
        let makeVisible = false;

        if (direction && direction.lengthSq() > 1e-8) {
            // *** Invert the direction vector before setting ***
            const invertedDirection = direction.clone().negate();
            arrow.setDirection(invertedDirection);
            arrow.setLength(params.arrowLength, params.arrowLength * ARROW_HEAD_LENGTH_RATIO, params.arrowLength * ARROW_HEAD_WIDTH_RATIO);
            makeVisible = isInside;
        } else {
            makeVisible = false;
        }

        // Set individual arrow visibility based on boundary check AND global toggle
        arrow.visible = params.showArrows && makeVisible; 
    });
}

/**
 * Updates the visibility of the arrow helpers group. 
 * Called by the UI toggle.
 */
function updateArrowVisibility() {
    // First, recalculate individual arrow visibility based on current params.showArrows and boundary
    updateArrowHelpers(); 
    // Then, set the visibility of the parent group based on the global toggle.
    arrowHelpersGroup.visible = params.showArrows;
}

// --- Slope Calculation Wrapper ---
/**
 * Calculates slope data (colors and gradients) and updates arrows.
 */
function calculateSlopeAndArrows() {
    const slopeData = calculateSlopeData(
        greenGeometry,
        segments, segments, // segmentsX, segmentsZ
        greenSize, greenSize // sizeX, sizeZ
    );

    if (slopeData && slopeData.gradients && slopeData.slopePercentages) { // Check for percentages too
        slopeGradients = slopeData.gradients; // Store gradients
        slopePercentages = slopeData.slopePercentages; // *** Store percentages ***
        updateArrowHelpers(); // Update arrows with new data
    } else {
        // Handle case where slope data failed
        slopeGradients = [];
        slopePercentages = []; // *** Clear percentages ***
        updateArrowHelpers(); 
    }
    updateEffectiveSize(); // *** Update effective size display ***
}

// --- Shape Generation Wrapper ---
/**
 * *** NEW: Regenerates the green shape outline based on current params. ***
 */
function regenerateShape() {
    // *** NEW: Clear holes if they exist before regenerating shape ***
    if (placedHoles.length > 0) {
        clearHoles();
    }
    
    currentGreenShapePoints = generateGreenShape(
        params.greenWidth,
        params.greenLength,
        params.greenIrregularity,
        params.shapeNumPoints,
        params.noiseOffset // *** NEW: Pass noise offset ***
    );

    applyClipping(greenGeometry, currentGreenShapePoints); // *** Call clipping function ***
    updateArrowHelpers(); // *** NEW: Update arrow visibility after shape changes ***
    updateEffectiveSize(); // *** Update effective size display ***
}

// --- Clipping Function --- NEW SECTION
/**
 * Checks if a 2D point is inside a polygon using the ray casting algorithm.
 * @param {THREE.Vector2} point The point to check (vertex x, z).
 * @param {THREE.Vector2[]} polygon An array of Vector2 points defining the polygon boundary.
 * @returns {boolean} True if the point is inside the polygon, false otherwise.
 */
function isPointInPolygon(point, polygon) {
    let inside = false;
    const x = point.x;
    const y = point.y; // Use y for the 2nd dimension (our Z)
    const n = polygon.length;

    if (n === 0) return false;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

// --- NEW: Distance Calculation Helpers ---

/**
 * Calculates the squared distance from a point (px, py) to a line segment (a.x, a.y) -> (b.x, b.y).
 * @param {number} px Point X
 * @param {number} py Point Y
 * @param {THREE.Vector2} a Segment start point
 * @param {THREE.Vector2} b Segment end point
 * @returns {number} Squared distance
 */
function pointSegmentDistanceSquared(px, py, a, b) {
    const l2 = a.distanceToSquared(b);
    if (l2 === 0) return a.distanceToSquared(new THREE.Vector2(px, py)); // Segment is a point
    
    // Project point (p) onto the line defined by segment (a, b)
    // Calculate t = dot(p-a, b-a) / |b-a|^2
    const t = ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / l2;
    const clampedT = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1] for segment

    // Calculate projection point
    const projectionX = a.x + clampedT * (b.x - a.x);
    const projectionY = a.y + clampedT * (b.y - a.y);

    // Squared distance from point to projection
    const dx = px - projectionX;
    const dy = py - projectionY;
    return dx * dx + dy * dy;
}

/**
 * Calculates the minimum distance from a point to the polygon boundary and determines if the point is inside.
 * @param {THREE.Vector2} point The point to check.
 * @param {THREE.Vector2[]} polygon The polygon boundary points.
 * @returns {{distance: number, isInside: boolean}} Minimum distance and inside status.
 */
function getSignedDistanceToPolygon(point, polygon) {
    let minDistanceSq = Infinity;
    const n = polygon.length;

    if (n < 3) return { distance: 0, isInside: false }; // Not a valid polygon

    for (let i = 0, j = n - 1; i < n; j = i++) {
        minDistanceSq = Math.min(minDistanceSq, pointSegmentDistanceSquared(point.x, point.y, polygon[i], polygon[j]));
    }

    const isInside = isPointInPolygon(point, polygon);
    const distance = Math.sqrt(minDistanceSq);
    
    return { distance, isInside };
}

// --- End Distance Helpers ---

/**
 * Applies clipping to the geometry based on the shape boundary.
 * Modifies the alpha component of vertex colors.
 * @param {THREE.BufferGeometry} geometry The geometry to clip.
 * @param {THREE.Vector2[]} shapeBoundary The 2D points defining the boundary.
 */
function applyClipping(geometry, shapeBoundary) {
    if (!geometry.attributes.color || !geometry.attributes.position) {
        console.error("Geometry missing required attributes (color/position) for clipping.");
        return;
    }
    const colors = geometry.attributes.color;
    const positions = geometry.attributes.position;
    // *** NEW: Get wireframe alpha attribute ***
    const wireframeAlphas = geometry.attributes.wireframeAlpha; 
    if (!wireframeAlphas) {
        console.error("Geometry missing wireframeAlpha attribute.");
        return;
    }

    const vertexCount = positions.count;
    const tempVertex2D = new THREE.Vector2();

    const hasValidBoundary = shapeBoundary && shapeBoundary.length >= 3;
    // *** Adjust target alpha to max 1.0 when slope colors shown ***
    const targetAlphaFull = params.showSlopeColors ? 1.0 : 0.0; 
    const fadeDistance = 0.25; // *** NEW: Define the fade distance (adjust as needed) ***

    for (let i = 0; i < vertexCount; i++) {
        tempVertex2D.set(
            positions.getX(i),
            positions.getZ(i) // Get Z coordinate for 2D check
        );

        let meshVertexAlpha = 0.0;
        let wireframeVertexAlpha = 1.0; // Wireframe fully visible if no boundary

        if (hasValidBoundary) {
            const { distance, isInside } = getSignedDistanceToPolygon(tempVertex2D, shapeBoundary);
            
            // Calculate signed distance (approximate, positive inside, negative outside)
            const signedDistance = isInside ? distance : -distance;
            
            // Use smoothstep for alpha transition across the boundary
            // t goes from 0 (outside fade zone) to 1 (inside fade zone)
            const t = THREE.MathUtils.smoothstep(signedDistance, -fadeDistance, fadeDistance);

            // *** Calculate alpha for mesh (respects color toggle) ***
            meshVertexAlpha = THREE.MathUtils.lerp(0.0, targetAlphaFull, t);
            // *** Calculate alpha for wireframe (always fades 0 to 1) ***
            wireframeVertexAlpha = t;

        } else {
            // No valid boundary, alpha depends only on the toggle
            meshVertexAlpha = targetAlphaFull; 
            wireframeVertexAlpha = 1.0; // Wireframe fully visible if no boundary
        }
        
        // Set the calculated alpha (W component) for the mesh color
        colors.setW(i, meshVertexAlpha); 
        // *** NEW: Set the calculated alpha for the wireframe ***
        wireframeAlphas.setX(i, wireframeVertexAlpha);
    }

    colors.needsUpdate = true; // IMPORTANT: Flag colors attribute for update
    wireframeAlphas.needsUpdate = true; // *** NEW: Flag wireframe alpha attribute for update ***
}

// --- Control Point Grid Setup ---
const controlPoints = [];
const controlPointGroup = new THREE.Group(); // Group for easy management
scene.add(controlPointGroup);

const controlPointSize = 0.1;
const controlPointGeometry = new THREE.SphereGeometry(controlPointSize, 16, 8);
const controlPointMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, // White control points
    transparent: true, // Make transparent
    opacity: 0.6       // Set opacity (adjust as needed)
});
// controlPointMaterial.visible = params.showMarkers; // Visibility handled by group

/**
 * Clears existing control points and generates a new grid based on params.gridResolution.
 */
function regenerateControlPoints() {
    // Clear existing points
    controlPointGroup.clear(); // Remove all children from the group
    controlPoints.length = 0; // Clear the array

    // Detach transform controls if attached to a point being removed
    if (transformControls.object && transformControls.object.parent !== controlPointGroup) {
         // This check might be overly cautious, but ensures we don't detach unnecessarily
         // Or, more simply, always detach when regenerating
         transformControls.detach();
    }
    
    // Read resolution from params
    const resolution = Math.max(2, Math.floor(params.gridResolution)); // Ensure at least 2x2
    const spacing = greenSize / (resolution - 1);
    controlPointMaterial.visible = params.showMarkers; // Set material visibility
    controlPointGroup.visible = params.showMarkers; // Also control group visibility

    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const x = -greenSize / 2 + i * spacing;
            const z = -greenSize / 2 + j * spacing;
            
            // Initial height calculation needs the mesh to exist, but we want default offset
            // We will correct height using updateAllControlPointHeights shortly
            const y = CONTROL_POINT_Y_OFFSET; 

            const controlPoint = new THREE.Mesh(controlPointGeometry, controlPointMaterial.clone()); // Clone material
            controlPoint.position.set(x, y, z);
            controlPointGroup.add(controlPoint); // Add to group
            controlPoints.push(controlPoint);
        }
    }
    // Update heights based on current mesh (important after regeneration)
    updateAllControlPointHeights(); 
    
    // Update visibility based on current param state (redundant? Handled above)
    // updateControlPointVisibility();
}

// --- Controls (OrbitControls) --- ADDING BACK
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Add inertia to camera movement
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false; // Prevents odd panning behaviour
controls.minDistance = 5;
controls.maxDistance = 50;
// controls.maxPolarAngle = Math.PI / 2 - 0.05; // Limit vertical rotation slightly above horizon

// --- Transform Controls Setup --- ADDING BACK
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);
transformControls.size = 1; // Explicitly set size

// *** NEW: Change gizmo colors to white ***
transformControls.traverse((child) => {
    if (child.material) {
        // Clone the material to avoid affecting other parts unintentionally
        child.material = child.material.clone();
        // Set the color to white
        if (child.material.color) { // Check if the material has a color property
            child.material.color.set(0xffffff);
        }
    }
});
// transformControls.update(); // Usually not needed just for color

// --- Vertex Deformation Logic ---

let dragStartPosition = null; // Store CONTROl POINT position when dragging starts
// Original Y-positions will be stored *after* initial plane rotation
let originalVertexPositionsY = null;
// *** NEW: Store vertex positions at the START of a drag operation ***
let vertexPositionsAtDragStart = null;

/**
 * Stores the initial Y positions of the geometry vertices.
 * Must be called *after* any initial transformations (like rotation).
 * @param {THREE.PlaneGeometry} geometry
 */
function storeOriginalYPositions(geometry) {
    const positions = geometry.attributes.position;
    originalVertexPositionsY = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i++) {
        originalVertexPositionsY[i] = positions.getY(i);
    }
}

/**
 * *** REVISED *** Updates the green mesh vertices based on the control point's total displacement.
 * Also updates the Y-position of all control points to follow the mesh surface.
 * @param {THREE.Object3D} controlPoint The control point being moved.
 * @param {THREE.PlaneGeometry} geometry The geometry to deform.
 * @param {number} radius The falloff radius. Passed directly now.
 * @param {THREE.Vector3} startPos The position of the control point when dragging started.
 * @param {Float32Array} basePositions The Y positions of the vertices when dragging started.
 */
function updateVertices(controlPoint, geometry, radius, startPos, basePositions) {
    // *** NEW: Clear holes if they exist before modifying ***
    if (placedHoles.length > 0) {
        clearHoles();
    }

    const positions = geometry.attributes.position;
    const controlPos = controlPoint.position;
    // *** Calculate TOTAL displacement since drag start ***
    const totalDeltaY = controlPos.y - startPos.y;

    const vertex = new THREE.Vector3();
    const controlPos2D = new THREE.Vector2(controlPos.x, controlPos.z);
    const vertex2D = new THREE.Vector2();

    const radiusSquared = radius * radius;
    // *** Adjust sigma slightly - make falloff a bit wider relative to radius ***
    // const sigmaSquared = radiusSquared / 9; // Original
    const sigmaSquared = radiusSquared / 6; // Try making falloff broader
    if (sigmaSquared === 0) return; // Avoid division by zero

    // *** DEBUG REMOVED ***
    // let loggedWeights = false;

    for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);
        vertex2D.set(vertex.x, vertex.z);
        const distanceSquared = controlPos2D.distanceToSquared(vertex2D);

        const weight = Math.exp(-distanceSquared / (2 * sigmaSquared));

        const baseY = basePositions[i]; 
        const newY = baseY + totalDeltaY * weight;
        positions.setY(i, newY);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // *** Call wrapper function for slopes/arrows FIRST ***
    calculateSlopeAndArrows();
    // *** NEW: Update all other control point heights ***
    updateAllControlPointHeights(); 
    // *** NEW: Update contour lines ***
    updateContourLines();
}

/**
 * *** NEW *** Updates the Y-position of all control points to follow the mesh surface.
 */
function updateAllControlPointHeights() {
    controlPoints.forEach(cp => {
        const interpolatedY = getInterpolatedHeight(
            cp.position.x,
            cp.position.z,
            greenGeometry, 
            segments, 
            segments, 
            greenSize, // Assuming square green for interpolation size for now
            greenSize
        );
        cp.position.y = interpolatedY + CONTROL_POINT_Y_OFFSET;
    });
    // We might need to update transformControls if one is attached
    if (transformControls.object) {
        // No explicit update needed for position, but good to be aware
    }
}

// --- Reset Function ---
/**
 * Resets the elevation of the green mesh and control points.
 */
function resetElevation() {
    // *** NEW: Clear holes if they exist before resetting ***
    if (placedHoles.length > 0) {
        clearHoles();
    }

    if (!originalVertexPositionsY) {
        return;
    }

    const positions = greenGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        positions.setY(i, originalVertexPositionsY[i]);
    }
    positions.needsUpdate = true;
    greenGeometry.computeVertexNormals(); // Update normals
    
    // *** Call slope/arrow update FIRST after resetting mesh ***
    calculateSlopeAndArrows();

    // *** Also clear any temporary drag-start vertex positions ***
    vertexPositionsAtDragStart = null;

    // *** NEW: Reset all control point heights to follow the reset mesh ***
    updateAllControlPointHeights();
    // *** NEW: Update contour lines ***
    updateContourLines();
}

// --- Transform Controls Event Listeners ---
transformControls.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value; // Disable OrbitControls while dragging
    if (event.value) {
        // Drag started:
        // 1. Store the initial position of the control point
        dragStartPosition = transformControls.object.position.clone();
        // *** 2. Store the CURRENT Y positions of all mesh vertices ***
        vertexPositionsAtDragStart = Float32Array.from(greenGeometry.attributes.position.array.filter((_, idx) => idx % 3 === 1));

    } else {
        // Drag ended:
        // 1. Clear the control point start position
        dragStartPosition = null;
        // *** 2. Clear the temporary vertex start positions ***
        // (We keep the changes made during the drag)
        vertexPositionsAtDragStart = null;
    }
});

// Listener for when the attached object is moved
transformControls.addEventListener('objectChange', function() {
   // *** Ensure we have both the control point start position AND vertex start positions ***
   if (transformControls.object && dragStartPosition && vertexPositionsAtDragStart) {
       // *** Pass params.falloffRadius directly ***
       updateVertices(transformControls.object, greenGeometry, params.falloffRadius, dragStartPosition, vertexPositionsAtDragStart);
   }
});

// --- Raycasting for Control Point Selection ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// *** UPDATED: pointer down logic for selection and deselection ***
function onPointerDown(event) {
    // *** ADD: If placing holes, do nothing here ***
    if (isPlacingHoles) return; 
    
    // Important: Prevent OrbitControls from initiating drag when clicking on TransformControls handle
    if (transformControls.dragging) return;

    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray
    raycaster.setFromCamera(mouse, camera);

    // *** FIX: Only check intersections with VISIBLE control points ***
    const visibleControlPoints = controlPoints.filter(cp => cp.visible);

    // Check for intersections with control points
    const intersects = raycaster.intersectObjects(visibleControlPoints); // Use the filtered list

    if (intersects.length > 0) {
        const object = intersects[0].object;
        // Attach controls only if not already attached to the same object
        if (transformControls.object !== object) {
            transformControls.attach(object);
            transformControls.setMode('translate');
            transformControls.showX = false;
            transformControls.showY = true;
            transformControls.showZ = false;
        }
        // If already attached, clicking the same point does nothing, which is fine
    } else {
        // Clicked outside any control point: Deselect if something is selected
        if (transformControls.object) {
            transformControls.detach();
        }
    }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown, false);

// --- Helper Functions ---

/**
 * Updates the visibility of the contour lines group.
 */
function updateContourVisibility() {
    contourGroup.visible = params.showContours;
}

/**
 * Generates and updates the contour lines based on the green geometry.
 * TODO: Implement the actual contouring algorithm (e.g., Marching Squares).
 */
function updateContourLines() {
    if (!params.showContours) {
        // Optimization: If contours are hidden, clear geometry and return
        contourGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); // Clear positions
        return;
    }
    
    const contourLevelStep = 0.01; // Height difference between contours
    const vertices = [];
    const positions = greenGeometry.attributes.position;
    const vertexCount = positions.count;

    // Determine height range
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < vertexCount; i++) {
        const y = positions.getY(i);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }

    // Helper for linear interpolation
    const lerp = (p1, p2, level) => {
        const t = (level - p1.y) / (p2.y - p1.y);
        return p1.clone().lerp(p2, t);
    };

    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();

    // Iterate through each quad (cell) of the grid
    for (let row = 0; row < segments; row++) {
        for (let col = 0; col < segments; col++) {
            // Get the 4 vertices of the current quad
            const idx0 = row * vertsWidth + col;
            const idx1 = row * vertsWidth + (col + 1);
            const idx2 = (row + 1) * vertsWidth + (col + 1);
            const idx3 = (row + 1) * vertsWidth + col;

            p0.fromBufferAttribute(positions, idx0);
            p1.fromBufferAttribute(positions, idx1);
            p2.fromBufferAttribute(positions, idx2);
            p3.fromBufferAttribute(positions, idx3);

            // Iterate through contour levels
            for (let level = Math.ceil(minY / contourLevelStep) * contourLevelStep; level <= maxY; level += contourLevelStep) {
                const points = [];
                // Check intersections with each edge
                if ((p0.y > level) !== (p1.y > level)) points.push(lerp(p0, p1, level));
                if ((p1.y > level) !== (p2.y > level)) points.push(lerp(p1, p2, level));
                if ((p2.y > level) !== (p3.y > level)) points.push(lerp(p2, p3, level));
                if ((p3.y > level) !== (p0.y > level)) points.push(lerp(p3, p0, level));

                // Add line segments (pairs of points)
                if (points.length >= 2) {
                    vertices.push(points[0].x, points[0].y, points[0].z);
                    vertices.push(points[1].x, points[1].y, points[1].z);
                }
                 if (points.length === 4) { // Handle ambiguous case (connect opposite pairs)
                    vertices.push(points[2].x, points[2].y, points[2].z);
                    vertices.push(points[3].x, points[3].y, points[3].z);
                }
            }
        }
    }

    if (vertices.length > 0) {
        contourGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    } else {
        contourGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); // Clear if no vertices
    }
    contourGeometry.computeBoundingSphere(); // Important for visibility checks
}

/**
 * Updates the visibility of the wireframe overlay.
 */
function updateWireframeVisibility() {
    wireframe.visible = params.wireframeVisible;
}

/**
 * Updates the visibility of the control point markers.
 */
function updateControlPointVisibility() {
    controlPoints.forEach(cp => cp.visible = params.showMarkers); // Ensure individual visibility is set
    // Control visibility via the group and material
    controlPointGroup.visible = params.showMarkers;
    controlPointMaterial.visible = params.showMarkers; // Keep this for potential efficiency

    // Also hide/show TransformControls if they are attached and markers are hidden/shown
    if (transformControls.object && !params.showMarkers) {
        transformControls.detach();
    }
    // Note: Re-attaching when shown is handled by the click selection logic
}

/**
 * *** NEW: Updates the material to show/hide slope colors ***
 */
function updateSlopeColorVisibility() {
    // *** Instead of toggling mesh visibility, we re-apply clipping ***
    // greenMesh.visible = params.showSlopeColors;
    // *** ALSO trigger outline height update, as the mesh height might be relevant now ***
    // updateOutlineHeight(); // Redundant: called after shape regen and vertex updates
    applyClipping(greenGeometry, currentGreenShapePoints); // Re-apply alpha values
}

// --- Effective Size Calculation & Display --- NEW SECTION

/**
 * Calculates the percentage of the visible green area with slope < 4%
 * and updates the UI display.
 */
function updateEffectiveSize() {
    const sizeValueElement = document.getElementById('effective-size-value');
    if (!sizeValueElement) {
        console.error("Effective size display element not found.");
        return;
    }

    const positions = greenGeometry.attributes.position;
    const vertexCount = positions.count;
    const hasValidBoundary = currentGreenShapePoints && currentGreenShapePoints.length >= 3;
    const tempVertex2D = new THREE.Vector2();

    let visibleVertices = 0;
    let puttAbleVertices = 0;

    if (vertexCount !== slopePercentages.length) {
        // console.warn("Vertex count mismatch with slope percentages. Skipping effective size update."); // REMOVED
        sizeValueElement.textContent = "--%";
        return;
    }

    for (let i = 0; i < vertexCount; i++) {
        tempVertex2D.set(positions.getX(i), positions.getZ(i));
        
        // Check if vertex is inside the defined shape boundary
        const isInside = hasValidBoundary ? isPointInPolygon(tempVertex2D, currentGreenShapePoints) : true; 

        if (isInside) {
            visibleVertices++;
            if (slopePercentages[i] < 4.0) { // Check slope percentage
                puttAbleVertices++;
            }
        }
    }

    let percentage = 0;
    if (visibleVertices > 0) {
        percentage = (puttAbleVertices / visibleVertices) * 100;
    }

    sizeValueElement.textContent = `${percentage.toFixed(0)}%`; // Display as integer percentage
}

// *** NEW: Click vs Drag Detection State ***
let pointerDownTime = 0;
let pointerDownCoords = new THREE.Vector2();
const MAX_CLICK_DURATION = 200; // ms
const MAX_CLICK_DISTANCE_SQ = 5 * 5; // pixels squared

// *** NEW: Function passed from UI to control button ***
let updateFinishButtonState = () => { console.error("updateFinishButtonState not initialized!"); }; // Placeholder with error
// *** NEW: Function to control Place button state ***
let updatePlaceButtonState = () => { console.error("updatePlaceButtonState not initialized!"); };

// --- Hole Placement Functions --- NEW SECTION

/**
 * Event handler for mouse movement during hole placement mode.
 * Updates the position and visibility of the hole indicator.
 * @param {PointerEvent} event 
 */
function onPointerMoveHolePlacement(event) {
    if (!isPlacingHoles || !holePlacementIndicator) return;

    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections with the green mesh
    const intersects = raycaster.intersectObject(greenMesh); // Check only greenMesh

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const point = intersection.point;
        const faceIndex = intersection.faceIndex;

        // Find the closest vertex index from the face
        // Note: face.a, face.b, face.c are indices into the geometry's position attribute
        const face = intersection.face;
        const positions = greenGeometry.attributes.position;
        const pA = new THREE.Vector3().fromBufferAttribute(positions, face.a);
        const pB = new THREE.Vector3().fromBufferAttribute(positions, face.b);
        const pC = new THREE.Vector3().fromBufferAttribute(positions, face.c);

        // Simple check: find the closest vertex of the intersected face
        // A more accurate approach might involve barycentric coordinates
        const distASq = point.distanceToSquared(pA);
        const distBSq = point.distanceToSquared(pB);
        const distCSq = point.distanceToSquared(pC);

        let closestVertexIndex = face.a;
        if (distBSq < distASq && distBSq < distCSq) {
            closestVertexIndex = face.b;
        } else if (distCSq < distASq) {
            closestVertexIndex = face.c;
        }

        // Check slope percentage at the closest vertex
        const isValid = slopePercentages[closestVertexIndex] !== undefined && slopePercentages[closestVertexIndex] < 4.0;

        // Also check if the intersection point is inside the clipping boundary
        const intersection2D = new THREE.Vector2(point.x, point.z);
        const hasValidBoundary = currentGreenShapePoints && currentGreenShapePoints.length >= 3;
        const isInsideBoundary = hasValidBoundary ? isPointInPolygon(intersection2D, currentGreenShapePoints) : true;

        if (isValid && isInsideBoundary) {
            holePlacementIndicator.position.copy(point);
            holePlacementIndicator.position.y += 0.005; // Slightly above surface
            holePlacementIndicator.visible = true;
        } else {
            holePlacementIndicator.visible = false;
        }

    } else {
        // Mouse is not over the mesh
        holePlacementIndicator.visible = false;
    }
}

/**
 * *** UPDATED *** Logic moved here. Attempts to place a hole at the given screen coordinates.
 * Checks validity, hole limit, and updates button state.
 * @param {number} screenX 
 * @param {number} screenY 
 */
function attemptPlaceHole(screenX, screenY) {
    // 1. Check hole limit
    if (placedHoles.length >= 3) {
        return;
    }
    
    // 2. Raycast from screen coordinates
    mouse.x = (screenX / window.innerWidth) * 2 - 1;
    mouse.y = - (screenY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(greenMesh);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const point = intersection.point;
        const face = intersection.face;
        const positions = greenGeometry.attributes.position;
        
        // Find closest vertex (same logic as hover)
        const pA = new THREE.Vector3().fromBufferAttribute(positions, face.a);
        const pB = new THREE.Vector3().fromBufferAttribute(positions, face.b);
        const pC = new THREE.Vector3().fromBufferAttribute(positions, face.c);
        const distASq = point.distanceToSquared(pA);
        const distBSq = point.distanceToSquared(pB);
        const distCSq = point.distanceToSquared(pC);
        let closestVertexIndex = face.a;
        if (distBSq < distASq && distBSq < distCSq) closestVertexIndex = face.b;
        else if (distCSq < distASq) closestVertexIndex = face.c;

        // Check validity (slope and boundary, same logic as hover)
        const isValidSlope = slopePercentages[closestVertexIndex] !== undefined && slopePercentages[closestVertexIndex] < 4.0;
        const intersection2D = new THREE.Vector2(point.x, point.z);
        const hasValidBoundary = currentGreenShapePoints && currentGreenShapePoints.length >= 3;
        const isInsideBoundary = hasValidBoundary ? isPointInPolygon(intersection2D, currentGreenShapePoints) : true;

        if (isValidSlope && isInsideBoundary) {
            // Create a persistent hole marker
            const holeMarkerGeometry = new THREE.CircleGeometry(HOLE_MARKER_RADIUS, 32);
            holeMarkerGeometry.rotateX(-Math.PI / 2); // Make it horizontal
            const holeMarkerMaterial = new THREE.MeshBasicMaterial({ 
                color: HOLE_MARKER_COLOR, 
                transparent: true,
                opacity: 0.8, 
                side: THREE.DoubleSide
            });
            const holeMarker = new THREE.Mesh(holeMarkerGeometry, holeMarkerMaterial);
            
            holeMarker.position.copy(point);
            holeMarker.position.y += 0.006; 
            
            holesGroup.add(holeMarker); 
            placedHoles.push(holeMarker); 
            
            // *** NEW: Auto-exit if 3 holes are placed ***
            if (placedHoles.length >= 3) {
                exitHolePlacementMode(); // Exit the mode automatically
                // *** NEW: Disable Place button ***
                updatePlaceButtonState(false);
            }

        } else {
            
        }
    }
}

/**
 * *** NEW *** Records pointer down time and position for click detection.
 * @param {PointerEvent} event 
 */
function onPointerDownStartCheck(event) {
    if (!isPlacingHoles) return;
    pointerDownTime = Date.now();
    pointerDownCoords.set(event.clientX, event.clientY);
}

/**
 * *** NEW *** Checks if pointer up corresponds to a click (not a drag).
 * If it's a click, attempts to place a hole.
 * @param {PointerEvent} event 
 */
function onPointerUpEndCheck(event) {
    if (!isPlacingHoles) return;

    const upTime = Date.now();
    const duration = upTime - pointerDownTime;

    if (duration < MAX_CLICK_DURATION) {
        const dx = event.clientX - pointerDownCoords.x;
        const dy = event.clientY - pointerDownCoords.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < MAX_CLICK_DISTANCE_SQ) {
            // It's a click! Attempt placement
            attemptPlaceHole(event.clientX, event.clientY);
        }
    }
    // Reset time/coords (optional, but good practice)
    pointerDownTime = 0;
    pointerDownCoords.set(0,0);
}

/**
 * Enters the hole placement mode.
 * Updates mesh colors and sets up event listeners.
 */
function enterHolePlacementMode() {
    if (isPlacingHoles) return; // Already in this mode
    isPlacingHoles = true;

    // 1. Store current colors
    if (!greenGeometry.attributes.color) {
        console.error("Cannot enter placement mode: Geometry missing color attribute.");
        isPlacingHoles = false;
        return;
    }
    originalColorsBeforePlacement = greenGeometry.attributes.color.array.slice();
    
    // 2. Update mesh colors (valid/invalid based on slope)
    const colors = greenGeometry.attributes.color;
    const positions = greenGeometry.attributes.position;
    const vertexCount = positions.count;
    const hasValidBoundary = currentGreenShapePoints && currentGreenShapePoints.length >= 3;
    const tempVertex2D = new THREE.Vector2();
    const fadeDistance = 0.25; // Consistent with applyClipping

    if (vertexCount !== slopePercentages.length) {
        // console.warn("Vertex count mismatch with slope percentages. Cannot accurately update colors for hole placement."); // REMOVED
    }

    for (let i = 0; i < vertexCount; i++) {
        tempVertex2D.set(positions.getX(i), positions.getZ(i));
        let currentAlpha = 0.0;
        if (hasValidBoundary) {
            const { distance, isInside } = getSignedDistanceToPolygon(tempVertex2D, currentGreenShapePoints);
            const signedDistance = isInside ? distance : -distance;
            const t = THREE.MathUtils.smoothstep(signedDistance, -fadeDistance, fadeDistance);
            currentAlpha = t; 
        } else {
             currentAlpha = 1.0; 
        }
        
        const isValidPlacement = slopePercentages[i] !== undefined && slopePercentages[i] < 4.0;
        const targetColor = isValidPlacement ? HOLE_PLACEMENT_VALID_COLOR : HOLE_PLACEMENT_INVALID_COLOR;
        
        colors.setXYZ(i, targetColor.r, targetColor.g, targetColor.b);
        colors.setW(i, currentAlpha);
    }
    colors.needsUpdate = true;

    // 3. Setup Indicator & Listeners
    if (!holePlacementIndicator) { // Create indicator if it doesn't exist
        // *** UPDATED: Use CircleGeometry, black color ***
        const indicatorGeometry = new THREE.CircleGeometry(HOLE_MARKER_RADIUS, 32);
        indicatorGeometry.rotateX(-Math.PI / 2); // Make it horizontal
        const indicatorMaterial = new THREE.MeshBasicMaterial({ 
            color: HOLE_INDICATOR_COLOR, 
            transparent: true, 
            opacity: HOLE_INDICATOR_OPACITY,
            side: THREE.DoubleSide // Important for flat geometry
        });
        holePlacementIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        scene.add(holePlacementIndicator);
    }
    holePlacementIndicator.visible = false; // Start hidden
    renderer.domElement.addEventListener('pointermove', onPointerMoveHolePlacement);
    // *** UPDATED: Add listeners for click detection ***
    renderer.domElement.addEventListener('pointerdown', onPointerDownStartCheck);
    renderer.domElement.addEventListener('pointerup', onPointerUpEndCheck);

    // 4. Disable controls & Update Button State
    if (transformControls.object) {
        transformControls.detach();
    }
    transformControls.enabled = false;
    // *** Hide control points explicitly ***
    controlPointGroup.visible = false; 
    // *** NEW: Enable finish button immediately on entering mode ***
    updateFinishButtonState(true);
}

/**
 * Exits the hole placement mode.
 * Restores original colors and removes listeners.
 */
function exitHolePlacementMode() {
    if (!isPlacingHoles) return; // Not in this mode
    isPlacingHoles = false;

    // 1. Restore original mesh colors
    if (originalColorsBeforePlacement && greenGeometry.attributes.color) {
        greenGeometry.attributes.color.array.set(originalColorsBeforePlacement);
        greenGeometry.attributes.color.needsUpdate = true;
        originalColorsBeforePlacement = null; // Clear stored data
    } else {
        // console.warn("Could not restore original colors. Triggering full update."); // REMOVED
        calculateSlopeAndArrows(); 
        updateSlopeColorVisibility();
    }

    // 2. Remove listener and hide indicator
    renderer.domElement.removeEventListener('pointermove', onPointerMoveHolePlacement);
    // *** UPDATED: Remove listeners for click detection ***
    renderer.domElement.removeEventListener('pointerdown', onPointerDownStartCheck);
    renderer.domElement.removeEventListener('pointerup', onPointerUpEndCheck);
    if (holePlacementIndicator) {
        holePlacementIndicator.visible = false;
    }
    
    // 3. Re-enable controls & Update Button State
    transformControls.enabled = true;
    // *** Restore control point visibility based on params ***
    updateControlPointVisibility(); 
    // *** NEW: Disable finish button on exit ***
    updateFinishButtonState(false); 
}

/**
 * Clears any placed holes.
 */
function clearHoles() {
    // Ensure we exit placement mode if active (this will remove listeners)
    // exitHolePlacementMode(); // Don't exit, just clear while in mode?
    // Let's keep the user in placement mode after clearing.
    
    // console.log("Clearing holes..."); // REMOVED
    
    // Remove hole markers from the scene
    holesGroup.clear(); // Remove all children from the group
    placedHoles.length = 0; // Clear the reference array

    // Also hide indicator if it's somehow still visible
    if (holePlacementIndicator) {
        holePlacementIndicator.visible = false; // Hide until next move
    }
    
    // *** REMOVED: Button state handled by enter/exit mode ***
    // updateFinishButtonState(false);
    // *** NEW: Re-enable Place button ***
    updatePlaceButtonState(true);
}

// *** Capture the REAL function from the UI setup return value ***
const uiControls = setupUI(params, {
    resetElevation,
    updateWireframeVisibility,
    updateControlPointVisibility,
    updateSlopeColorVisibility,
    updateArrowVisibility,
    updateContourVisibility, 
    regenerateShape, 
    regenerateControlPoints, 
    updateContourLines, // *** Pass contour update function ***
    // Hole placement functions remain the same
    enterHolePlacementMode,
    exitHolePlacementMode,
    clearHoles
    // No longer need to pass the placeholder back
});

if (uiControls && typeof uiControls.updateFinishButtonState === 'function') {
    updateFinishButtonState = uiControls.updateFinishButtonState;
} else {
    console.error("Main: Failed to capture updateFinishButtonState from UI!");
}
// *** NEW: Capture Place button state function ***
if (uiControls && typeof uiControls.updatePlaceButtonState === 'function') {
    updatePlaceButtonState = uiControls.updatePlaceButtonState;
} else {
    console.error("Main: Failed to capture updatePlaceButtonState from UI!");
}

// --- Initial state setup ---
storeOriginalYPositions(greenGeometry);
regenerateShape(); // Generate initial shape boundary
regenerateControlPoints(); // *** Generate initial control points AFTER mesh exists ***
createArrowHelpers(); // Create arrows initially
calculateSlopeAndArrows(); // Calculate initial slopes and update arrows
updateContourLines(); // *** Generate initial contour lines ***
updateControlPointVisibility(); // Set initial visibility
updateWireframeVisibility(); // Set initial visibility
updateSlopeColorVisibility(); // Set initial mesh visibility based on clipping
updateArrowVisibility(); // Set initial arrow group visibility
updateContourVisibility(); // *** Set initial contour visibility ***

// --- Resize Handling ---
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Update pixel ratio on resize

    // *** REMOVE Update LineMaterial resolution on resize ***
    // if (shapeOutlineLine && shapeOutlineLine.material instanceof LineMaterial) {
    //     shapeOutlineLine.material.resolution.set(window.innerWidth, window.innerHeight);
    // }
}

// --- Render Loop ---
function animate() {
    requestAnimationFrame(animate);

    controls.update(); // Required if enableDamping is true

    // TransformControls also need rendering updates if active
    // The check for object presence isn't strictly necessary but good practice
    if (transformControls.object) {
        // No explicit update needed here for TransformControls itself
        // but we will update vertices based on its position later
    }

    renderer.render(scene, camera);
}

// --- Start ---
animate(); // Start the animation loop

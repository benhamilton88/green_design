let slopeGradients = [];
let slopePercentages = []; 
let isPlacingHole = false;
let originalVertexColors = null;
let originalWireframeAlphas = null;
const arrowHelpersGroup = new THREE.Group();

const PLACEMENT_VALID_COLOR = new THREE.Color(0x00ff00);
const PLACEMENT_INVALID_COLOR = new THREE.Color(0x808080);

// --- Hole Marker Setup --- NEW
const HOLE_RADIUS = 0.054; // Regulation golf hole radius in meters (approx)
const HOLE_COLOR = 0x050505; // Very dark grey/black
const HOLE_Y_OFFSET = 0.002; // Place slightly above mesh surface

const holeGeometry = new THREE.CircleGeometry(HOLE_RADIUS, 16); // Simple circle
holeGeometry.rotateX(-Math.PI / 2); // Make it horizontal
const holeMaterial = new THREE.MeshBasicMaterial({ 
    color: HOLE_COLOR, 
    side: THREE.DoubleSide // Visible from below if camera dips
});

const placedHolesGroup = new THREE.Group();
scene.add(placedHolesGroup);
const placedHoles = []; // Array to store references to hole meshes
const MAX_HOLES = 3;

// Temporary marker for hover preview
const hoverHoleMarker = new THREE.Mesh(holeGeometry, holeMaterial.clone()); // Use cloned material
hoverHoleMarker.material.opacity = 0.6; // Make hover marker slightly transparent
hoverHoleMarker.material.transparent = true;
hoverHoleMarker.visible = false; // Initially hidden
scene.add(hoverHoleMarker); // Add directly to scene for now
// --- End Hole Marker Setup ---

function enterHolePlacementMode() {
    if (isPlacingHole) return;
    isPlacingHole = true;
    console.log("Entering hole placement mode.");

    controls.enabled = false;

    originalVertexColors = greenGeometry.attributes.color.clone();
    if (greenGeometry.attributes.wireframeAlpha) {
        originalWireframeAlphas = greenGeometry.attributes.wireframeAlpha.clone();
    }

    const colors = greenGeometry.attributes.color;
    const wireframeAlphas = greenGeometry.attributes.wireframeAlpha;
    const vertexCount = colors.count;
    const hasValidBoundary = currentGreenShapePoints && currentGreenShapePoints.length >= 3;
    const tempVertex2D = new THREE.Vector2();
    const positions = greenGeometry.attributes.position;

    if (vertexCount !== slopePercentages.length) {
        console.error("Vertex count mismatch with slope percentages in placement mode.");
        exitHolePlacementMode();
        return;
    }

    // console.log("Placement Mode - Vertex Counts:", vertexCount, slopePercentages.length); // Debug log
    for (let i = 0; i < vertexCount; i++) {
        tempVertex2D.set(positions.getX(i), positions.getZ(i));
        const isInside = hasValidBoundary ? isPointInPolygon(tempVertex2D, currentGreenShapePoints) : true;
        let targetMeshAlpha = 0.0;
        let targetWireframeAlpha = 0.0;

        // *** Add temporary logging ***
        // if (i < 10) { // Log first few vertices only
        //    console.log(`Vertex ${i}: isInside=${isInside}, slope=${slopePercentages[i]?.toFixed(2)}`);
        // }

        if (isInside) {
            targetMeshAlpha = 1.0;
            targetWireframeAlpha = 1.0;
            if (slopePercentages[i] < 4.0) {
                colors.setXYZ(i, PLACEMENT_VALID_COLOR.r, PLACEMENT_VALID_COLOR.g, PLACEMENT_VALID_COLOR.b);
            } else {
                colors.setXYZ(i, PLACEMENT_INVALID_COLOR.r, PLACEMENT_INVALID_COLOR.g, PLACEMENT_INVALID_COLOR.b);
            }
        } else {
            colors.setXYZ(i, PLACEMENT_INVALID_COLOR.r, PLACEMENT_INVALID_COLOR.g, PLACEMENT_INVALID_COLOR.b);
            targetMeshAlpha = 0.0;
            targetWireframeAlpha = 0.0;
        }
        colors.setW(i, targetMeshAlpha);
        if (wireframeAlphas) {
            wireframeAlphas.setX(i, targetWireframeAlpha);
        }
    }
    colors.needsUpdate = true;
    if (wireframeAlphas) {
        wireframeAlphas.needsUpdate = true;
    }
    
    const startButton = document.getElementById('start-placing-holes-button');
    const finishButton = document.getElementById('finish-placing-holes-button');
    if (startButton) startButton.disabled = true;
    if (finishButton) finishButton.disabled = false;
    
    renderer.domElement.addEventListener('pointermove', onPointerMoveHolePlacement);
    renderer.domElement.addEventListener('pointerdown', onPointerDownHolePlacement);
    document.body.style.cursor = 'crosshair';
}

function exitHolePlacementMode() {
    if (!isPlacingHole) return;
    isPlacingHole = false;
    console.log("Exiting hole placement mode.");
    
    hoverHoleMarker.visible = false;
    
    controls.enabled = true;
    
    if (originalVertexColors) {
        greenGeometry.setAttribute('color', originalVertexColors);
        originalVertexColors = null;
    }
    if (originalWireframeAlphas && greenGeometry.attributes.wireframeAlpha) {
        greenGeometry.setAttribute('wireframeAlpha', originalWireframeAlphas);
        originalWireframeAlphas = null;
    }
    
    calculateSlopeAndArrows();
    applyClipping(greenGeometry, currentGreenShapePoints);

    const startButton = document.getElementById('start-placing-holes-button');
    const finishButton = document.getElementById('finish-placing-holes-button');
    if (startButton) startButton.disabled = false;
    if (finishButton) finishButton.disabled = true;
    
    renderer.domElement.removeEventListener('pointermove', onPointerMoveHolePlacement);
    renderer.domElement.removeEventListener('pointerdown', onPointerDownHolePlacement);
    document.body.style.cursor = 'default';
}

function clearHoles() {
    placedHolesGroup.clear();
    placedHoles.length = 0;
    console.log("Placed holes cleared.");
}

setupUI(params, {
    resetElevation,
    updateWireframeVisibility,
    updateControlPointVisibility,
    updateSlopeColorVisibility,
    updateArrowVisibility,
    updateContourVisibility,
    regenerateShape,
    regenerateControlPoints,
    enterHolePlacementMode,
    exitHolePlacementMode,
    clearHoles
}); 

// --- Vertex Deformation Logic ---
// ... existing code ...

// --- Control Point Grid Setup ---
// ... existing code ...

// --- Reset Function ---
/**
 * Resets the elevation of the green mesh and control points.
 */
function resetElevation() {
    // ... vertex reset logic ...
    calculateSlopeAndArrows();

    // *** Also clear any temporary drag-start vertex positions ***
    vertexPositionsAtDragStart = null;

    // *** NEW: Reset all control point heights to follow the reset mesh ***
    updateAllControlPointHeights();
    // *** NEW: Update contour lines ***
    updateContourLines();
    
    // *** NEW: Clear placed holes ***
    clearHoles();

    console.log("Elevation reset.");
}

// --- Transform Controls Event Listeners ---
// ... existing code ... 

// --- Raycasting & Placement Logic --- UPDATED & NEW

// Keep existing selection logic separate
function onPointerDownSelection(event) {
     // Prevent interfering with hole placement
    if (isPlacingHole) return;
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

// Separate listener for hole placement hover
function onPointerMoveHolePlacement(event) {
    if (!isPlacingHole) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(greenMesh); // Raycast against the green mesh only

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const point = intersection.point;
        const face = intersection.face;

        // Find the closest *vertex* index to the intersection point
        let closestVertexIndex = -1;
        let minDistanceSq = Infinity;
        const vertex = new THREE.Vector3();

        const indices = [face.a, face.b, face.c];
        indices.forEach(index => {
            vertex.fromBufferAttribute(greenGeometry.attributes.position, index);
            const distSq = vertex.distanceToSquared(point);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestVertexIndex = index;
            }
        });

        if (closestVertexIndex !== -1 && slopePercentages[closestVertexIndex] < 4.0) {
            // Valid placement location
            hoverHoleMarker.position.set(point.x, point.y + HOLE_Y_OFFSET, point.z);
            hoverHoleMarker.visible = true;
             document.body.style.cursor = 'pointer'; // Indicate clickable
        } else {
            // Invalid placement location
            hoverHoleMarker.visible = false;
            document.body.style.cursor = 'not-allowed'; // Indicate non-clickable
        }
    } else {
        hoverHoleMarker.visible = false;
         document.body.style.cursor = 'crosshair'; // Reset to default placement cursor
    }
}

// Separate listener for hole placement click
function onPointerDownHolePlacement(event) {
    // Only act if in placement mode and not clicking a control point gizmo
    if (!isPlacingHole || transformControls.dragging) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(greenMesh);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const point = intersection.point;
        const face = intersection.face;

        // Find closest vertex index (same logic as hover)
        let closestVertexIndex = -1;
        let minDistanceSq = Infinity;
        const vertex = new THREE.Vector3();
        const indices = [face.a, face.b, face.c];
        indices.forEach(index => {
            vertex.fromBufferAttribute(greenGeometry.attributes.position, index);
            const distSq = vertex.distanceToSquared(point);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestVertexIndex = index;
            }
        });

        // Check validity and hole limit
        if (closestVertexIndex !== -1 && slopePercentages[closestVertexIndex] < 4.0) {
            if (placedHoles.length < MAX_HOLES) {
                // Place the hole
                const newHole = new THREE.Mesh(holeGeometry, holeMaterial);
                newHole.position.set(point.x, point.y + HOLE_Y_OFFSET, point.z);
                placedHolesGroup.add(newHole);
                placedHoles.push(newHole);
                console.log(`Hole placed at (${point.x.toFixed(2)}, ${point.z.toFixed(2)}). Total: ${placedHoles.length}`);
                // If max holes reached after placing this one, exit placement mode
                if (placedHoles.length >= MAX_HOLES) {
                    exitHolePlacementMode(); 
                }
            } else {
                console.log("Maximum number of holes reached.");
                 exitHolePlacementMode(); // Exit if max reached
            }
        } else {
            console.log("Cannot place hole here: Slope too steep or invalid location.");
        }
    } 
}

// Replace original listener assignment
// renderer.domElement.addEventListener('pointerdown', onPointerDown, false); // Original combined listener
renderer.domElement.addEventListener('pointerdown', onPointerDownSelection, false); // Add specific listener for selection

// --- UI Setup Call ---
setupUI(params, {
    resetElevation,
    updateWireframeVisibility,
    updateControlPointVisibility,
    updateSlopeColorVisibility,
    updateArrowVisibility,
    updateContourVisibility,
    regenerateShape,
    regenerateControlPoints,
    enterHolePlacementMode,
    exitHolePlacementMode,
    clearHoles // *** NEW: Pass clear holes function ***
});

// --- Initial state setup ---
storeOriginalYPositions(greenGeometry);
regenerateShape(); 
regenerateControlPoints(); 
createArrowHelpers(); 
calculateSlopeAndArrows(); 
updateContourLines(); 
updateControlPointVisibility(); 
updateWireframeVisibility(); 
updateSlopeColorVisibility(); 
updateArrowVisibility(); 
updateContourVisibility(); 

// --- Resize Handling ---
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

// --- Render Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update(); 
    renderer.render(scene, camera);
}

// --- Start ---
console.log("Three.js scene initialized.");
animate(); // Start the animation loop 
import * as THREE from 'three';

// Define the new color palette based on slope percentage
const COLOR_0_1 = new THREE.Color(0x87CEFA); // Cyan-like Light Blue (was 0xA0C0FF)
const COLOR_1_2 = new THREE.Color(0x4169E1); // Royal Blue
const COLOR_2_3 = new THREE.Color(0x39FF14); // Neon Green (was 0x90EE90)
const COLOR_3_4 = new THREE.Color(0x006400); // Dark Green
const COLOR_4_5 = new THREE.Color(0xFF0000); // Red
const COLOR_5_6 = new THREE.Color(0xFFA500); // Orange
const COLOR_6_PLUS = new THREE.Color(0xFF69B4); // Hot Pink

/**
 * Calculates slope steepness, color, and downhill gradient for each vertex.
 * @param {THREE.BufferGeometry} geometry - The geometry to calculate slopes for.
 * @param {number} segmentsX - Number of segments along the X axis of the original plane.
 * @param {number} segmentsZ - Number of segments along the Z axis of the original plane.
 * @param {number} sizeX - The size of the original plane along its X axis.
 * @param {number} sizeZ - The size of the original plane along its Z axis.
 * @returns {{colorsAttribute: THREE.BufferAttribute, gradients: THREE.Vector3[], slopePercentages: number[]}} - Object containing the updated color attribute, an array of gradient vectors, and an array of slope percentages.
 */
export function calculateSlopeData(geometry, segmentsX, segmentsZ, sizeX, sizeZ) {
    geometry.computeVertexNormals();

    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const colors = geometry.attributes.color;

    if (!colors || !normals || !positions) {
        console.error("Geometry missing required attributes (color/normal/position) for slope calculation.");
        return { colorsAttribute: null, gradients: [], slopePercentages: [] };
    }

    const vertexCount = positions.count;
    const gradients = new Array(vertexCount).fill(null);
    const slopePercentages = new Array(vertexCount).fill(0);
    const vertsWidth = segmentsX + 1;
    const dx = sizeX / segmentsX;
    const dz = sizeZ / segmentsZ;

    const up = new THREE.Vector3(0, 1, 0);
    const tempNormal = new THREE.Vector3();
    const gradient = new THREE.Vector3();

    for (let i = 0; i < vertexCount; i++) {
        tempNormal.fromBufferAttribute(normals, i);
        
        // Calculate slope angle and percentage
        const angle = tempNormal.angleTo(up);
        const slopePercent = Math.tan(angle) * 100;
        slopePercentages[i] = slopePercent;

        // Determine color based on slope percentage
        let color;
        if (slopePercent < 1) color = COLOR_0_1;
        else if (slopePercent < 2) color = COLOR_1_2;
        else if (slopePercent < 3) color = COLOR_2_3;
        else if (slopePercent < 4) color = COLOR_3_4;
        else if (slopePercent < 5) color = COLOR_4_5;
        else if (slopePercent < 6) color = COLOR_5_6;
        else color = COLOR_6_PLUS;

        // Apply color (assuming RGBA format from main.js)
        colors.setXYZ(i, color.r, color.g, color.b);

        // Calculate gradient (downhill direction on the XZ plane)
        // Project the normal onto the XZ plane and negate
        gradient.set(-tempNormal.x, 0, -tempNormal.z);
        
        if (gradient.lengthSq() > 1e-8) {
             // Normalize *before* storing for consistent direction vector
             gradients[i] = gradient.normalize().clone();
        } else {
             gradients[i] = null;
        }
       
    }

    colors.needsUpdate = true;

    return { colorsAttribute: colors, gradients: gradients, slopePercentages: slopePercentages };
}

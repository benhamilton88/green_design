import * as THREE from 'three';
// *** Import the simplex noise library ***
// Make sure you have installed 'simplex-noise' via npm/yarn
// or are importing from a valid ES Module URL.
import { createNoise2D } from 'simplex-noise'; // Adjust path/URL if needed

// *** Create a 2D noise function instance ***
const noise2D = createNoise2D();

/**
 * Generates the 2D points for the outline of the green.
 * Uses an ellipse base shape with Simplex noise applied to the radius.
 *
 * @param {number} width - The maximum width (X-axis diameter) of the base ellipse.
 * @param {number} length - The maximum length (Z-axis diameter) of the base ellipse.
 * @param {number} irregularity - The amplitude of the noise applied to the radius.
 * @param {number} numPoints - The number of points to generate for the outline.
 * @param {number} noiseOffset - An offset value to vary the noise pattern.
 * @param {number} [radiusOffset=0] - An additional offset added to the base radius before noise.
 * @returns {THREE.Vector2[]} An array of Vector2 points defining the green outline.
 */
export function generateGreenShape(width, length, irregularity, numPoints, noiseOffset = 0, radiusOffset = 0) {
    const points = [];
    const a = width / 2;
    const b = length / 2;

    if (a <= 0 || b <= 0 || numPoints <= 2) {
        console.warn("Invalid parameters for shape generation. Returning default shape.");
        const defaultRadius = 1;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            points.push(new THREE.Vector2(Math.cos(angle) * defaultRadius, Math.sin(angle) * defaultRadius));
        }
        return points;
    }

    const noiseFrequency = 0.7; // *** Lowered frequency for smoother, broader features ***

    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);

        // Calculate the base radius of the ellipse
        const denominator = Math.sqrt(Math.pow(b * cosAngle, 2) + Math.pow(a * sinAngle, 2));
        const baseRadius = denominator === 0 ? 0 : (a * b) / denominator;

        // *** Apply optional radius offset BEFORE noise ***
        const offsetBaseRadius = baseRadius + radiusOffset;

        // *** Calculate noise input coordinates using angle and offset ***
        // We map the circular angle to coordinates in the 2D noise space.
        // The noiseOffset shifts our sampling position in the noise field.
        // The frequency determines how quickly the noise changes.
        const noiseX = (cosAngle * noiseFrequency) + noiseOffset;
        const noiseY = (sinAngle * noiseFrequency) + noiseOffset; // Apply offset to both for simplicity

        // *** Get Simplex noise value (-1 to 1) ***
        const noiseValue = noise2D(noiseX, noiseY);

        // Apply irregularity: noiseValue is [-1, 1]. Scale by irregularity param.
        const noiseFactor = 1 + irregularity * noiseValue;
        // Clamp factor lightly to prevent radius becoming zero or negative, allow more pinching.
        // *** Apply noise to the OFFSET base radius ***
        const finalRadius = offsetBaseRadius * Math.max(0.1, noiseFactor);

        // Convert polar coordinates back to Cartesian
        const x = finalRadius * cosAngle;
        const z = finalRadius * sinAngle;

        points.push(new THREE.Vector2(x, z));
    }

    // --- 3. Find Bounds and Center --- 
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // --- 4. Scale to Fit Target Size & Center --- 
    const actualWidth = maxX - minX;
    const actualHeight = maxY - minY;

    // *** Define the absolute maximum size constraint ***
    const maxFinalSize = 9.5; 

    // Calculate potential scale factors to fit within maxFinalSize
    const scaleX = (actualWidth > 1e-6) ? maxFinalSize / actualWidth : 1;
    const scaleY = (actualHeight > 1e-6) ? maxFinalSize / actualHeight : 1;
    
    // *** Use the *smaller* scale factor to maintain aspect ratio ***
    const scale = Math.min(scaleX, scaleY); 

    const finalPoints = points.map(p => {
        // First, center the point around (0,0)
        const centeredX = p.x - centerX;
        const centeredY = p.y - centerY;
        // Then, scale it proportionally to fit the maxFinalSize
        return new THREE.Vector2(centeredX * scale, centeredY * scale); // Apply the same scale factor
    });

    return finalPoints;
}

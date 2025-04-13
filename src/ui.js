// import { Pane } from 'tweakpane'; // REMOVED

export function setupUI(params, updateFunctions) {
    // TODO: Get references to HTML elements and add event listeners
    // console.log("Setting up custom UI..."); // REMOVED
    // Placeholder - we will add logic here step-by-step

    // Example of accessing the panel (we'll need elements inside later)
    const panel = document.getElementById('custom-controls-panel');
    if (!panel) {
        console.error('Custom controls panel element not found!');
        return;
    }
    
    // Get reference to the color key panel
    const colorKeyPanel = document.getElementById('color-key-panel');
    if (!colorKeyPanel) {
        console.error('Color key panel element not found!');
        // Decide if this is critical; maybe return null or proceed without key
    }
    
    // *** Declare the function OUTSIDE the IF block ***
    let updateFinishButtonState = () => {}; // Default empty function

    // Clear any existing content in case of re-setup (unlikely here, but good practice)
    // panel.innerHTML = ''; 
    
    // --- Wireframe Toggle --- 
    const wireframeToggle = document.getElementById('wireframe-toggle');
    if (wireframeToggle) {
        // Set initial state
        wireframeToggle.checked = params.wireframeVisible;

        // Add event listener
        wireframeToggle.addEventListener('change', (event) => {
            params.wireframeVisible = event.target.checked;
            if (updateFunctions.updateWireframeVisibility) {
                updateFunctions.updateWireframeVisibility();
            }
        });
    } else {
        console.error('Wireframe toggle element not found!');
    }

    // --- Slope Colors Toggle ---
    const slopeColorsToggle = document.getElementById('slope-colors-toggle');
    if (slopeColorsToggle) {
        slopeColorsToggle.checked = params.showSlopeColors;
        // Set initial visibility of color key
        if (colorKeyPanel) colorKeyPanel.style.display = params.showSlopeColors ? 'block' : 'none';
        
        slopeColorsToggle.addEventListener('change', (event) => {
            params.showSlopeColors = event.target.checked;
            // Update 3D view
            if (updateFunctions.updateSlopeColorVisibility) {
                updateFunctions.updateSlopeColorVisibility();
            }
            // Update color key visibility
            if (colorKeyPanel) colorKeyPanel.style.display = params.showSlopeColors ? 'block' : 'none';
        });
    } else {
        console.error('Slope colors toggle element not found!');
    }

    // --- Arrows Toggle ---
    const arrowsToggle = document.getElementById('arrows-toggle');
    if (arrowsToggle) {
        arrowsToggle.checked = params.showArrows;
        arrowsToggle.addEventListener('change', (event) => {
            params.showArrows = event.target.checked;
            if (updateFunctions.updateArrowVisibility) {
                updateFunctions.updateArrowVisibility();
            }
        });
    } else {
        console.error('Arrows toggle element not found!');
    }

    // --- Markers Toggle ---
    const markersToggle = document.getElementById('markers-toggle');
    if (markersToggle) {
        markersToggle.checked = params.showMarkers;
        markersToggle.addEventListener('change', (event) => {
            params.showMarkers = event.target.checked;
            if (updateFunctions.updateControlPointVisibility) {
                updateFunctions.updateControlPointVisibility();
            }
        });
    } else {
        console.error('Markers toggle element not found!');
    }

    // --- Contour Lines Toggle ---
    const contoursToggle = document.getElementById('contours-toggle');
    if (contoursToggle) {
        contoursToggle.checked = params.showContours;
        contoursToggle.addEventListener('change', (event) => {
            params.showContours = event.target.checked;
            // Update visibility first
            if (updateFunctions.updateContourVisibility) {
                updateFunctions.updateContourVisibility();
            }
            // *** If turning ON, also recalculate lines ***
            if (params.showContours && updateFunctions.updateContourLines) {
                updateFunctions.updateContourLines();
            }
        });
    } else {
        console.error('Contour toggle element not found!');
    }

    // --- Reset Elevation Button ---
    const resetButton = document.getElementById('reset-elevation-button');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (updateFunctions.resetElevation) {
                updateFunctions.resetElevation();
                // Optional: Reset slider visually if needed, though params should be source of truth
                // falloffSlider.value = params.falloffRadius; // Reset slider if params were reset
                // falloffValueSpan.textContent = params.falloffRadius.toFixed(1);
            }
        });
    } else {
        console.error('Reset button element not found!');
    }

    // --- Helper function for setting up sliders ---
    function setupSlider(sliderId, valueSpanId, paramKey, updateFn, decimalPlaces = 1) {
        const slider = document.getElementById(sliderId);
        const valueSpan = valueSpanId ? document.getElementById(valueSpanId) : null;

        if (slider) {
            // Set initial state
            slider.value = params[paramKey];
            if (valueSpan) { 
                valueSpan.textContent = parseFloat(params[paramKey]).toFixed(decimalPlaces);
            }

            // Add event listener
            slider.addEventListener('input', (event) => {
                const newValue = parseFloat(event.target.value);
                params[paramKey] = newValue;
                if (valueSpan) { 
                    valueSpan.textContent = newValue.toFixed(decimalPlaces);
                }
                if (updateFn) {
                    updateFn(); // Call the provided update function
                }
            });
        } else {
            console.error(`Slider element not found for: ${sliderId}`);
        }
    }

    // --- Green Shape Sliders ---
    setupSlider('width-slider', null, 'greenWidth', updateFunctions.regenerateShape);
    setupSlider('length-slider', null, 'greenLength', updateFunctions.regenerateShape);
    setupSlider('irregularity-slider', null, 'greenIrregularity', updateFunctions.regenerateShape, 2);
    setupSlider('noise-offset-slider', null, 'noiseOffset', updateFunctions.regenerateShape);

    // --- Terrain Editing Sliders ---
    setupSlider('grid-resolution-slider', null, 'gridResolution', updateFunctions.regenerateControlPoints, 0);
    setupSlider('falloff-slider', null, 'falloffRadius', null);

    // --- Help Panel Logic (Revised for Click Toggle) --- 
    const helpIcon = document.getElementById('help-icon');
    const helpPanel = document.getElementById('help-panel');
    const closeHelpButton = document.getElementById('help-panel-close-button'); // Get new close button

    if (helpIcon && helpPanel && closeHelpButton) {
        // Toggle panel on icon click
        helpIcon.addEventListener('click', () => {
            helpPanel.classList.toggle('visible');
        });

        // Hide panel on close button click
        closeHelpButton.addEventListener('click', () => {
             helpPanel.classList.remove('visible');
        });

    } else {
        console.error('Help icon, panel, or close button elements not found!');
    }

    // --- Place Hole Button Logic --- UPDATED for 3 buttons
    const startPlacingButton = document.getElementById('start-placing-holes-button');
    const finishPlacingButton = document.getElementById('finish-placing-holes-button');
    const clearHolesButton = document.getElementById('clear-holes-button');

    if (startPlacingButton && finishPlacingButton && clearHolesButton) {
        // Start Placing
        startPlacingButton.addEventListener('click', () => {
             if (updateFunctions.enterHolePlacementMode) {
                updateFunctions.enterHolePlacementMode();
             }
        });

        // Finish Placing (explicitly exit mode) 
        // *** REMOVE existing listener ***
        // finishPlacingButton.addEventListener('click', () => {
        //     if (updateFunctions.exitHolePlacementMode) {
        //         updateFunctions.exitHolePlacementMode();
        //      }
        // });
        
        // *** RE-ADD listener with logging ***
        finishPlacingButton.addEventListener('click', () => {
            console.log("UI: Finish Placing Holes button CLICKED."); // *** ADD LOG ***
            if (updateFunctions.exitHolePlacementMode) {
                updateFunctions.exitHolePlacementMode();
             } else {
                 console.error("exitHolePlacementMode function missing!");
             }
        });
        
        // Clear Holes
        clearHolesButton.addEventListener('click', () => {
             if (updateFunctions.clearHoles && updateFunctions.exitHolePlacementMode) {
                 // Always attempt to exit placement mode first (it has internal check)
                 // updateFunctions.exitHolePlacementMode(); // *** REMOVE THIS LINE ***
                 // Then clear the holes
                 updateFunctions.clearHoles(); // Just call clearHoles
             } else {
                 console.error('clearHoles or exitHolePlacementMode function missing from updateFunctions');
             }
        });
        
        // *** Define the function locally using function keyword ***
        // *** MOVED function definition ABOVE the IF block ***
        // function updateFinishButtonState(enabled) { ... }
        
        // *** Assign the REAL function implementation here ***
        updateFinishButtonState = (enabled) => { // Use arrow function again for simplicity here
            // console.log(`UI: Setting finish button enabled state to: ${enabled}`); // REMOVED
            if (enabled) {
                finishPlacingButton.removeAttribute('disabled');
                // *** Explicitly set enabled styles ***
                finishPlacingButton.style.backgroundColor = ''; // Revert to default CSS rule
                finishPlacingButton.style.cursor = 'pointer';
            } else {
                finishPlacingButton.setAttribute('disabled', true);
                // *** Explicitly set disabled styles (optional but good practice) ***
                finishPlacingButton.style.backgroundColor = '#444'; // Match CSS
                finishPlacingButton.style.cursor = 'not-allowed';
            }
        }; // End of function assignment

        // Set initial state (disabled)
        // console.log("UI: Setting initial finish button state."); // REMOVED
        updateFinishButtonState(false); // Call the assigned function

    } else {
        console.error('One or more hole placement button elements not found!');
    }

    // --- (End of controls) ---
    
    // *** Return the panel AND the function needed by main.js ***
    // *** Now returning the variable declared outside the IF block ***
    return { panel, updateFinishButtonState }; 
}

# 3D Green Designer

## ⛳ Overview

This is a creative-tech exploration inspired by StrackaLine green contour maps. It's an interactive web tool that allows users to procedurally generate the outline of a golf green, sculpt its undulation using a simple control system, and visualize the resulting slope.

This project was built rapidly over a short period (approx. 1-2 days) purely for fun and experimentation, leveraging AI code generation (Gemini 2.5 Pro via Cursor) alongside Three.js.

## ✨ How it Works

1.  **Green Shape Generation:** The outline of the green is generated procedurally. It starts with a base ellipse shape, and Perlin noise is applied to the radius to create natural-looking irregularities. Users can control the overall Width, Length, and the amount of Irregularity via sliders.
2.  **Mesh & Deformation:** A high-resolution plane mesh represents the green surface. A lower-resolution grid of draggable control points is overlaid. When a user drags a control point (primarily along the vertical Y-axis), the underlying mesh vertices are deformed using a Gaussian falloff function. This means the closer a vertex is to the dragged control point, the more its elevation is affected, creating smooth mounds and depressions. The size of this influence (falloff radius) can be adjusted.
3.  **Clipping:** Vertices of the plane mesh that fall outside the generated procedural shape boundary are visually hidden using alpha blending and `alphaTest`, effectively clipping the plane to the desired green shape.
4.  **Slope Visualization:**
    *   **Colors:** The steepness of the slope at each point on the mesh is calculated by analyzing the vertex normals. Steeper slopes get hotter colors (e.g., red/yellow), while flatter areas are cooler (e.g., green/blue). This is displayed as a heatmap using vertex colors. A color key is provided below the controls.
    *   **Arrows:** Small arrows are displayed sparsely across the green, pointing downhill to indicate the direction of the slope (the gradient).
    *   **Hole Placement:** Users can enter a 'Place Hole' mode. In this mode, they can click on areas of the green where the slope is below a certain threshold (e.g., 4%) to place up to 3 hole markers. A hover indicator shows valid placement areas.
5.  **User Interface:** Controls for shape, deformation, visualization toggles, and hole placement are provided using the Tweakpane library.

## 🛠️ Tech Stack

*   **3D Rendering & Logic:** Three.js
*   **UI Controls:** Tweakpane
*   **Core Language:** JavaScript (ES Modules)
*   **Styling:** HTML, CSS
*   **Development Assistance:** Gemini 2.5 Pro (via Cursor)
*   **Hosting:** Vercel (intended)

## 🚀 Running Locally

Because this project uses JavaScript Modules (`import` statements), you cannot simply open the `index.html` file directly in your browser from the filesystem (due to security restrictions - CORS policy). You need to serve the files using a local web server.

1.  **Navigate:** Open your terminal or command prompt and navigate to the root directory of this project (`masters-green-undulation`).
2.  **Serve:**
    *   **If you have Node.js installed:** The easiest way is often using `npx`. Run the command:
        ```bash
        npx serve
        ```
        It will typically serve the site at `http://localhost:3000` (it will tell you the exact address).
    *   **If you have Python 3 installed:** Run the command:
        ```bash
        python3 -m http.server
        ```
        It will typically serve the site at `http://localhost:8000`.
    *   **Other methods:** You can also use live server extensions in code editors like VS Code/Cursor.
3.  **Open:** Open the provided local URL (e.g., `http://localhost:3000`) in your web browser.

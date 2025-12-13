# GEOTE Climate UI – Semester Project

![GitHub last commit](https://img.shields.io/github/last-commit/MetrPikeska/geote-klima-ui)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Project Overview

This project was developed as part of a semester project for the GEOTE course at the Department of Geoinformatics, during the Winter Semester 2025. The climate data utilized in this application was provided by the university.

**GEOTE Climate UI** is a web application designed for analyzing and visualizing climate indicators. It allows users to study climate data for pre-defined administrative units (ORP - Municipalities with Extended Powers, CHKO - Protected Landscape Areas) or custom-drawn geographic polygons within the Czech Republic. The application leverages PostGIS for robust spatial analysis and provides insights into historical and projected climate normals.

## Key Features

-   **Flexible Spatial Unit Selection:** Choose between predefined administrative units (ORP, CHKO) or define custom areas using interactive drawing tools on the map.
-   **Interactive Map Interface:** Powered by Leaflet.js, offering a dynamic map experience with integrated polygon drawing capabilities via Leaflet.draw.
-   **Comprehensive Climate Normals:** Perform calculations across various reference climate periods:
    -   **Old Normal:** Based on historical data up to 1990.
    -   **New Normal:** Utilizes data from the period 1991–2020.
    -   **Prediction 2050:** Forecasted data from 2041 onwards.
-   **Diverse Climate Indicators:** Supports the calculation and visualization of:
    -   De Martonne Aridity Index.
    -   Potential Evapotranspiration (Thornthwaite).
-   **Intuitive Results Visualization:** Presents analysis outcomes in clear, organized tables (left sidebar) and dynamic, interactive line graphs (right sidebar) powered by Chart.js.
-   **Optimized Data Processing:** De Martonne and PET indices are efficiently loaded directly from the PostgreSQL database when pre-calculated, falling back to client-side computation otherwise.

## Technologies Used

### Frontend
-   HTML5, CSS3, JavaScript (Vanilla JS modules for API, charts, compute, map, UI logic)
-   [Leaflet.js](https://leafletjs.com/) for interactive mapping.
-   [Leaflet.draw](https://leaflet.github.io/Leaflet.draw/) for custom polygon creation.
-   [Chart.js](https://www.chartjs.org/) for data visualization.

### Backend
-   [Node.js](https://nodejs.org/) with [Express.js](https://expressjs.com/) for handling climate calculations.
-   `cors` for Cross-Origin Resource Sharing.
-   `body-parser` for parsing incoming request bodies.

### Database & Geospatial Services
-   [PostgreSQL](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) extension for advanced spatial data management and queries.
-   [pg-featureserv](https://github.com/CrunchyData/pg_featureserv) as an OGC API Features server for serving spatial data collections.

## Database Architecture

The project's data infrastructure is built upon a robust PostgreSQL database, heavily leveraging the PostGIS extension for advanced geospatial capabilities. The architecture is designed to efficiently store, process, and serve complex climate and cadastral data.

## Data Import Workflow

Raw climate data, typically in CSV format, is initially imported into dedicated intermediate tables within PostgreSQL. This process is managed by a custom Python script (e.g., `import.py`), which handles the initial ingestion of raw data.

## Master Table Creation (SQL-based)

The core of the project's spatial data is the `climate_master_geom` table. This central master table is created using SQL JOIN operations, integrating the imported intermediate climate data with a cadastral layer (`ku_cr`). The `climate_master_geom` table stores:
-   **Geometry:** MultiPolygon spatial data, specifically in EPSG:5514 (S-JTSK / Krovak East North) coordinate reference system.
-   **Climate Variables:** Monthly and annual climate variables.
-   **Computed Indices:** Pre-calculated climate indicators such as the De Martonne aridity index and Potential Evapotranspiration (Thornthwaite).

## Derived Spatial Layers (ORP, CHKO)

Aggregated spatial layers for administrative units like ORP (Municipalities with Extended Powers) and CHKO (Protected Landscape Areas) are derived from the `climate_master_geom` master table. This derivation is performed using SQL spatial aggregation techniques, enabling efficient querying and visualization of climate indicators at these higher administrative levels.

## Database Requirements

-   **PostgreSQL:** Version 12+ is required.
-   **PostGIS Extension:** The PostGIS extension is **MANDATORY** and must be installed and enabled in the project's database. This provides the necessary spatial functions and data types for the application's core functionality.
-   **Database Name:** A PostgreSQL database named `klima` must exist. If a different name is used, corresponding updates are required in `backend/db.js` and `pg-featureserv/config/pg_featureserv.toml`.
-   **Database User:** Ensure a PostgreSQL user (e.g., `postgres` with password `master`) has appropriate access privileges to the `klima` database. It is strongly recommended to use environment variables for sensitive credentials (e.g., `process.env.DB_PASSWORD`).

## Getting Started

Follow these steps to set up and run the project on your local machine.

### Prerequisites

Ensure you have the following software installed on your system:

-   **Node.js** (LTS version recommended) with `npm` (Node Package Manager).

### 1. Backend Server Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install Node.js dependencies:
    ```bash
    npm install
    ```
3.  Verify database connection settings in `backend/db.js`:
    ```javascript
    // backend/db.js
    const pool = new Pool({
      host: "localhost",
      user: "postgres",
      password: process.env.DB_PASSWORD || "master", // Consider using environment variables for sensitive info
      database: "klima",
      port: 5432
    });
    ```
    It's highly recommended to use environment variables for sensitive information like database passwords (e.g., `process.env.DB_PASSWORD`).

### 2. PostgreSQL Feature Server (`pg-featureserv`) Setup

`pg-featureserv` is distributed as a standalone executable. It is included in this repository for convenience.

1.  **Configuration:** The configuration file is located at `pg-featureserv/config/pg_featureserv.toml`. It's pre-configured for `HttpPort = 9000` and `DbConnection = "postgresql://postgres:master@localhost:5432/klima"`.
    *   **Important:** If your PostgreSQL credentials or database name differ, you **must** update the `DbConnection` string in `pg-featureserv/config/pg_featureserv.toml`.

### 3. Running the Application

#### On Windows (Recommended for quick start)

1.  **Start:** From the project root, simply run:
    ```bash
    .\start.bat
    ```
    This script will:
    *   Start the Node.js backend server (minimized).
    *   Change directory into `pg-featureserv` and start `pg_featureserv.exe serve` (minimized).
    *   Open `index.html` in your default web browser.
2.  **Stop:** To shut down both servers, run:
    ```bash
    .\stop.bat
    ```

#### On Linux/macOS (Manual Steps)

For non-Windows environments, you will need to start the components manually:

1.  **Start Node.js Backend:**
    ```bash
    cd backend
    node server.js
    # Keep this terminal open or run in background (e.g., using `nohup node server.js &`)
    cd ..
    ```
2.  **Start pg-featureserv:**
    *   Ensure the `pg-featureserv` executable has execute permissions (`chmod +x pg-featureserv/pg_featureserv.exe`).
    *   From the project root, run:
    ```bash
    cd pg-featureserv
    ./pg_featureserv serve
    # Keep this terminal open or run in background
    cd ..
    ```
3.  **Open Frontend:** Open `index.html` in your web browser.
    ```bash
    # Example for Linux, might vary
    xdg-open index.html
    # Example for macOS
    open index.html
    ```

### Git Ignoring

The `.gitignore` file is configured to exclude development-specific files and sensitive information, ensuring a clean and manageable repository.

## Usage

1.  **Select Spatial Unit:** Choose between "ORP", "CHKO", or "Custom Polygon". For predefined units, select from the dropdown. For custom polygons, use the drawing tools on the map.
2.  **Select Climate Normal and Indicator:** Choose your desired "Reference Normal" (Old, New, Prediction 2050) and "Climate Indicator" (De Martonne Aridity Index, Potential Evapotranspiration).
3.  **Calculate:** Click the "Calculate" button to process the data.
4.  **View Results:** Results are displayed in a table in the left panel, a summary box in the top-right, and an interactive line graph in the bottom-right panel.

## Project Structure

```
.
├── .gitignore                  # Specifies intentionally untracked files to ignore
├── index.html                  # Main HTML file for the frontend user interface
├── info.txt                    # Supplementary information file
├── opalena.geojson             # Sample GeoJSON data file
├── README.md                   # Project documentation and setup guide
├── start.bat                   # Windows batch script to start the application components
├── stop.bat                    # Windows batch script to stop the application components
├── backend/                    # Node.js Express backend server for climate calculations
│   ├── db.js                   # Database connection configuration for Node.js
│   ├── package-lock.json       # Records the exact dependency tree
│   ├── package.json            # Defines project metadata and dependencies
│   └── server.js               # Main Express server application
├── css/                        # Contains Cascading Style Sheets for the application
│   └── style.css               # Core styles for the user interface
├── js/                         # JavaScript modules for frontend logic
│   ├── api.js                  # Handles communication with OGC API Features and Node backend
│   ├── charts.js               # Manages chart rendering and data visualization with Chart.js
│   ├── compute.js              # Contains climate indicator computation logic
│   ├── map.js                  # Initializes and manages map interactions using Leaflet
│   └── ui.js                   # Manages user interface elements and event handling
└── pg-featureserv/             # PostgreSQL Feature Server (Crunchy Data pg_featureserv)
    ├── assets/                 # Static assets for the pg-featureserv web interface
    ├── config/                 # Configuration files for pg_featureserv
    ├── LICENSE.md              # License details for pg_featureserv
    ├── pg_featureserv.exe      # Executable application for the feature server
    └── README.md               # Documentation for pg_featureserv
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](#) file for details. (Note: A `LICENSE.md` file needs to be created in the root directory if not already present.)

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

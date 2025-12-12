# GEOTE Klima – Semester Project

Application for calculating climate indicators.

## Project Description

**GEOTE Klima** is a web application developed as part of a semester project, which allows users to analyze and visualize climate indicators for selected administrative units (municipalities with extended powers - ORP, protected landscape areas - CHKO) or user-defined geographic polygons in the Czech Republic. The application uses PostGIS for advanced spatial analysis and provides a comprehensive view of historical and predicted climate normals.

## Features

-   **Selection of Spatial Units:** Users can choose between predefined units (ORP, CHKO) or draw their own polygon directly on the map.
-   **Interactive Map:** Implementation of Leaflet.js with polygon drawing support (Leaflet.draw) for easy interaction with geographic data.
-   **Climate Normals:** Calculations can be performed for three reference climate normals:
    -   **Old Normal:** Data up to 1990.
    -   **New Normal:** Data from the period 1991–2020.
    -   **Prediction 2050:** Predicted data from 2041.
-   **Climate Indicators:** The application supports the calculation of the following indicators:
    -   De Martonne Aridity Index.
    -   Potential Evapotranspiration (Thornthwaite).
-   **Visualization of Results:** Results are presented in clear tables (in the left panel) and interactive line graphs (in the right panel – Chart.js).
-   **Optimized Calculations:** De Martonne and PET indices are primarily loaded directly from the database if pre-calculated, otherwise they are calculated on the client side.

## Technology

**Frontend:**
-   HTML5
-   CSS3 (`./css/style.css`)
-   JavaScript (`./js/api.js`, `./js/charts.js`, `./js/compute.js`, `./js/map.js`, `./js/ui.js`)
-   Leaflet.js (interactive map)
-   Leaflet.draw (polygon drawing)
-   Chart.js (graphs)

**Backend:**
-   Node.js
-   Express.js (web framework)
-   CORS (Cross-Origin Resource Sharing)
-   Body-parser (request processing)

**Database:**
-   PostgreSQL with PostGIS extension for spatial queries and analysis.

## Installation and Launch

### Prerequisites

Before you start, make sure you have the following installed:
-   Node.js (including npm)
-   PostgreSQL with PostGIS

### Quick Start (Windows)

For quick launching and shutting down the project on Windows, the following batch files have been created:

1.  **Launch Project:**
    *   Ensure all prerequisites are met (Node.js dependencies in `backend/` are installed and the PostgreSQL server is running with the `klima` database).
    *   Run the `start.bat` file.
    *   This file will automatically start the backend server (Node.js) and the PostgreSQL Feature Server in minimized windows and open `index.html` in your default browser.

2.  **Shut Down Project:**
    *   Run the `stop.bat` file.
    *   This file will terminate the running Node.js server and PostgreSQL Feature Server processes.

### Backend Setup

1.  Navigate to the `backend` folder:
    ```bash
    cd backend
    ```
2.  Install Node.js dependencies:
    ```bash
    npm install
    ```
3.  Ensure your PostgreSQL server is running and you have a database named `klima`. If you are using different credentials or a database name, modify the `backend/db.js` file.
    ```javascript
    // backend/db.js
    const pool = new Pool({
      host: "localhost",
      user: "postgres",
      password: "master",   // modify if you have a different password
      database: "klima",
      port: 5432
    });
    ```

### PostgreSQL Feature Server Setup

Since `pg-featureserv` is not included in the repository, you need to download it separately:

1.  **Download `pg-featureserv`:**
    *   Download the appropriate release of `pg-featureserv` for your operating system from its official GitHub releases page (e.g., [https://github.com/CrunchyData/pg_featureserv/releases](https://github.com/CrunchyData/pg_featureserv/releases)).
    *   Extract the contents of the downloaded archive into the project\'s root directory. Ensure that the `pg_featureserv.exe` (or equivalent executable) and the `config/` directory are correctly placed relative to the project root. The expected path for the executable is `pg-featureserv/pg_featureserv.exe`.

2.  **Configure `pg-featureserv`:**
    *   Navigate to the `pg-featureserv/config/` folder and copy the example configuration file:
        ```bash
        cd pg-featureserv/config/
        copy pg_featureserv.toml.example pg_featureserv.toml
        ```
    *   Open `pg_featureserv.toml` in a text editor and modify the `connstring` in the `[database]` section to match your PostgreSQL database settings (e.g., username and password). Example:
        ```toml
        [database]
        connstring = "host=localhost port=5432 user=postgres password=master dbname=klima"
        ```
        Ensure that `dbname` matches your database name (`klima`).

### Git Ignoring

- The `.gitignore` file has been created to automatically ignore files and folders that should not be part of the repository, such as `node_modules/`, `pg-featureserv/pg_featureserv.exe`, PostgreSQL Feature Server configuration, log files, and `.env` files.

## Usage

1.  **Select Spatial Unit:**
    -   Choose "ORP", "CHKO", or "Custom Polygon".
    -   For "ORP" or "CHKO", select a specific unit from the dropdown list.
    -   For "Custom Polygon", use the drawing tools on the map (top right) to create your own polygon.
2.  **Select Climate Normal and Indicator:**
    -   Choose "Reference Normal" (Old, New, Prediction 2050).
    -   Choose "Climate Indicator" (De Martonne Aridity Index, Potential Evapotranspiration).
3.  **Calculate:**
    -   Click the "Calculate" button.
4.  **View Results:**
    -   **Left Panel:** Displays a table with an overview of climate normals.
    -   **Right Panel:** The top section shows a summary of results, and the bottom section contains a line graph visualizing the climate indicator.

## Project Structure

```
.
├── .gitignore                  # Git ignore file
├── index.html                  # Main HTML file for the frontend
├── info.txt                    # Information file
├── opalena.geojson             # GeoJSON data file
├── README.md                   # Project README file
├── start.bat                   # Batch file to start the application
├── stop.bat                    # Batch file to stop the application
├── backend/                    # Folder with the Node.js backend server
│   ├── db.js                   # PostgreSQL database connection configuration
│   ├── package-lock.json       # Node.js package lock file
│   ├── package.json            # Dependencies and scripts for the backend
│   └── server.js               # Main backend server file (Express.js)
├── css/                        # Folder for CSS styles
│   └── style.css               # Main application styles
├── js/                         # Folder for frontend JavaScript modules
│   ├── api.js                  # Module for communication with the backend API
│   ├── charts.js               # Module for working with Chart.js graphs
│   ├── compute.js              # Module for calculation logic
│   ├── map.js                  # Module for map initialization and interaction (Leaflet)
│   └── ui.js                   # Module for managing the user interface and events
└── pg-featureserv/             # PostgreSQL Feature Server directory
    ├── assets/                 # Assets for pg-featureserv
    ├── config/                 # Configuration files for pg-featureserv
    ├── LICENSE.md              # License file for pg-featureserv
    ├── pg_featureserv.exe      # Executable for pg-featureserv
    └── README.md               # README for pg-featureserv

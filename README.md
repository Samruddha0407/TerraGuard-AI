# TerraGuard AI

A web-based landslide preparedness and environmental monitoring prototype.

## Features
- Search locations using Open-Meteo geocoding.
- Retrieve current weather and recent hourly precipitation from Open-Meteo.
- Interactive Leaflet map; selecting a map point triggers a weather lookup and risk screening.
- Transparent heuristic risk screening (Low / Moderate / High / Severe).
- Automatic high/severe screening alerts.
- Assessment history and alert history.
- TerraGuard Risk AI chat assistant with dashboard context.
- Optional Gemini integration; a built-in assistant works without an API key.
- MongoDB persistence when configured, with temporary in-memory storage fallback.

## Run locally
1. Install Node.js 18+.
2. Open a terminal in the `backend` folder.
3. Install dependencies: `npm install`.
4. Copy `.env.example` to `.env` and optionally fill in `MONGODB_URI` and `GEMINI_API_KEY`.
5. Start the app: `npm start`.
6. Open `http://localhost:5000`.

The app starts without MongoDB. In this mode assessments and alerts remain available only until the server stops. Add a MongoDB connection string to `.env` for persistent storage. Never commit `.env` or share database credentials.

## API
- `GET /api/health` — backend and database status.
- `POST /api/risk/assess` — calculate and save a screening assessment.
- `GET /api/assessments?limit=20` — assessment history.
- `GET /api/alerts?limit=20` — generated alerts.
- `POST /api/chat` — Risk AI assistant.

## Risk and safety limitations
The risk score is a transparent academic heuristic based on recent rainfall, seven-day accumulated rainfall, relative humidity and selected severe-weather codes. It is **not** a scientifically validated landslide prediction model. It does not incorporate slope angle, soil moisture, geology, land cover, drainage, field sensors or official warning feeds. A Low score does not mean a location is safe. Follow district and national disaster-management authorities and emergency services.

## Dashboard sections

- **Overview:** Search for a city or monitoring point and view current weather indicators.
- **Risk Map:** Interactive OpenStreetMap view. Click a point to load weather and run the screening heuristic for those coordinates.
- **Weather:** Current weather description, precipitation, temperature, humidity, 7-day accumulated precipitation and wind speed.
- **Current Risk Screening Details:** Shows the score, method and contributing indicators returned by the backend.
- **Alerts:** Displays saved High and Severe screening alerts. An empty state explains when alerts are generated.
- **Assessment Analytics & History:** Shows recent assessment records and a simple score bar visualization.
- **AI Assistant:** Answers questions using the latest dashboard context; uses Gemini when `GEMINI_API_KEY` is configured and otherwise uses the built-in rule-based assistant.
- **Settings & Assessment Information:** Explains score bands, factors, data sources and prototype limitations.

## Run locally

1. Install Node.js (LTS).
2. Open a terminal in `TerraGuard-AI/backend`.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and add optional MongoDB/Gemini credentials if desired.
5. Run `npm start` and open `http://localhost:5000`.

The score is an academic, rule-based weather-indicator screening heuristic, not a validated landslide prediction or official warning. Always follow local authorities.

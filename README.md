# Raksha Backend

Simple SIH-MVP REST API using Node.js, Express, MongoDB Atlas, Mongoose, JWT, bcrypt, Zod, dotenv, and CORS.

## Run

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to a MongoDB Atlas connection string and set a private `JWT_SECRET`.
3. Run `npm install`.
4. Run `npm run dev` or `npm start`.

The server will not start until MongoDB is reachable. AI endpoints use mock responses during development. AI signals are passed through the deterministic risk engine before final risk values are returned.

AI endpoints use mock responses during development when `AI_MOCK_MODE=true`; no external AI credentials are required for local demonstrations.

## Safe Route

`POST /api/routes/calculate` accepts `origin`, `destination`, and `mode` (`driving` or `walking`). The backend calls OpenRouteService, requests provider-returned alternatives, evaluates each returned geometry against OpenStreetMap Overpass context and Raksha user reports, and ranks the real routes by travel time and available safety data. Flutter never calls ORS directly.

Safety values are derived from available data and are not a guarantee of personal safety. Missing providers produce unavailable factors and no fabricated safety score. Historical crime is an abstraction point for future NCRB/state datasets and is currently unavailable unless a provider is implemented at a supported granularity.

Environment variables:

```env
ORS_API_KEY=
ORS_BASE_URL=https://api.heigit.org/openrouteservice/v2
OVERPASS_URL=https://overpass-api.de/api/interpreter
```

User safety reports can be submitted through authenticated `POST /api/safety/reports` and read without reporter identity through `GET /api/safety/reports/nearby?lat=...&lng=...&radius=1000`.

To test route calculation, set `ORS_API_KEY` in the backend `.env`, start MongoDB and the backend, then use the existing Flutter Plan Journey flow. If ORS is unavailable, the UI shows a retryable route error and does not draw a synthetic route.

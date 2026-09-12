# Raksha Backend

Simple SIH-MVP REST API using Node.js, Express, MongoDB Atlas, Mongoose, JWT, bcrypt, Zod, dotenv, and CORS.

## Run

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to a MongoDB Atlas connection string and set a private `JWT_SECRET`.
3. Run `npm install`.
4. Run `npm run dev` or `npm start`.

The server will not start until MongoDB is reachable. AI endpoints use mock responses during development. AI signals are passed through the deterministic risk engine before final risk values are returned.

require('dotenv').config();

const dns = require('dns');

// Use public DNS resolvers for MongoDB Atlas SRV records.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const connectDatabase = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const transitRoutes = require('./routes/transit.routes');
const emergencyRoutes = require('./routes/emergency.routes');
const aiRoutes = require('./routes/ai.routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', database: 'mongodb' }));
app.use('/api/auth', authRoutes);
app.use('/api/transit', transitRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/ai', aiRoutes);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { app, startServer };

import './src/config/env.js';
import app from './src/app.js';
import mongoCtx from './src/config/db.config.js';

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await mongoCtx();

    app.listen(PORT, () => {
      console.log(`Server is listening on ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

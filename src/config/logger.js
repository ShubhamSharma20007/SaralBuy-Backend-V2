import morgan from 'morgan';
import logger from '../middleware/logger.middleware.js';

const stream = {
  write: message => logger.info(message.trim()),
};
const morganMiddleware = morgan('combined', { stream: stream });
export default morganMiddleware;

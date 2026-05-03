import { SOCKET_EVENTS } from './socketEvents.js';
import userSchema from '../models/user.schema.js';
const chatSocket = (io, socket) => {
  const userId = socket.user._id;
  // get user doc
  socket.on(SOCKET_EVENTS.CHAT_USER, async sellerId => {
    const user = await userSchema.findById(sellerId).lean();
    delete user.password;
    socket.emit(SOCKET_EVENTS.CHAT_USER, user);
  });
};
export default chatSocket;

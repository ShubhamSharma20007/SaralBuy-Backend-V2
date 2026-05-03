import chatSocket from './chat.socket.js';
const registerSocketHandlers = (io, socket) => {
  chatSocket(io, socket);
};

export default registerSocketHandlers;

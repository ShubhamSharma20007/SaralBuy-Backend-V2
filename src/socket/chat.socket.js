import { SOCKET_EVENTS } from './socketEvents.js';
import userSchema from '../models/user.schema.js';
import chatSchema from '../models/chat.schema.js';
import mongoose from 'mongoose';
import productSchema from '../models/product.schema.js';
import { onlineUsers } from './onlineUsers.js';
import closeDealSchema from '../models/closeDeal.schema.js';
const chatSocket = (io, socket) => {
  const userId = socket.user._id.toString();

  // User Status

  socket.on(SOCKET_EVENTS.ONLINE_USER, () => {
    onlineUsers.set(userId, socket.id);
    io.emit(SOCKET_EVENTS.USER_STATUS, {
      userId,
      isOnline: true,
    });
  });

  //  Fetch seller info for sidebar ──────────────────────────
  socket.on(SOCKET_EVENTS.CHAT_USER, async sellerId => {
    const user = await userSchema.findById(sellerId).lean();
    if (!user) return;
    delete user.password;
    socket.emit(SOCKET_EVENTS.CHAT_USER, user);
  });

  //  Fetch all recent chats for the navbar / sidebar ────────
  socket.on(SOCKET_EVENTS.GET_USER_CHATS, async () => {
    try {
      const uid = new mongoose.Types.ObjectId(userId);

      const chats = await chatSchema
        .find({
          $or: [{ buyerId: uid }, { sellerId: uid }],
        })
        .sort({ updatedAt: -1 })
        .populate('buyerId', 'firstName lastName profileImage')
        .populate('sellerId', 'firstName lastName profileImage')
        .populate('productId', 'title')
        .lean();
      const shaped = await Promise.all(
        chats.map(async chat => {
          const isBuyer = chat.buyerId._id.toString() === userId;
          const partner = isBuyer ? chat.sellerId : chat.buyerId;

          return {
            roomId: chat.roomId,
            _id: chat._id,
            productId: chat.productId?._id || chat.productId || null,
            productName: chat.productId?.title || 'Product Discussion',
            buyerId: chat.buyerId._id.toString(),
            sellerId: chat.sellerId._id.toString(),
            name: `${partner.firstName} ${partner.lastName}`.trim(),
            avatar: partner.profileImage || '',
            lastMessage: chat.lastMessage,
            buyerUnreadCount: chat.buyerUnreadCount,
            sellerUnreadCount: chat.sellerUnreadCount,
            chatrating: isBuyer ? chat.buyerRating : chat.sellerRating,
            isOnline: false,
          };
        })
      );

      socket.emit(SOCKET_EVENTS.USER_CHATS, shaped);
    } catch (err) {
      console.error('GET_USER_CHATS error:', err);
      socket.emit(SOCKET_EVENTS.USER_CHATS, []); // Emit empty array on error
    }
  });

  //  Join a chat room ───────────────────────────────────────
  // Join a chat room ───────────────────────────────────────
  socket.on(SOCKET_EVENTS.JOIN_ROOM, async ({ roomId, buyerId, sellerId, productId }) => {
    socket.join(roomId);

    if (buyerId && sellerId && productId) {
      await chatSchema.findOneAndUpdate(
        { roomId },
        {
          $setOnInsert: {
            roomId,
            buyerId: new mongoose.Types.ObjectId(buyerId),
            sellerId: new mongoose.Types.ObjectId(sellerId),
            productId: new mongoose.Types.ObjectId(productId),
            messages: [],
            buyerUnreadCount: 0,
            sellerUnreadCount: 0,
            lastMessage: null,
          },
        },
        { upsert: true, new: true }
      );
    }

    const chat = await chatSchema.findOne({ roomId }).lean();
    if (chat) {
      socket.emit(SOCKET_EVENTS.RECEIVE_MESSAGE, { roomId, messages: chat.messages });
    }

    // ✅ Check for ANY deal on this room and restore state for both buyer and seller
    const latestDeal = await closeDealSchema
      .findOne({ roomId })
      .sort({ createdAt: -1 }) // get the most recent deal
      .lean();

    if (latestDeal) {
      const isSeller = chat && chat.sellerId.toString() === userId.toString();
      const isBuyer = chat && chat.buyerId.toString() === userId.toString();

      // ✅ Seller: show approval popup if deal is still pending their response
      if (isSeller && latestDeal.closedDealStatus === 'waiting_seller_approval') {
        socket.emit(SOCKET_EVENTS.PENDING_DEAL, {
          dealId: latestDeal._id.toString(),
          amount: latestDeal.amount,
          roomId: latestDeal.roomId,
          buyerId: latestDeal.buyerId.toString(),
          sellerId: latestDeal.sellerId.toString(),
        });
      }

      // ✅ Both buyer AND seller: restore final status on refresh
      if (
        latestDeal.closedDealStatus === 'completed' ||
        latestDeal.closedDealStatus === 'rejected'
      ) {
        socket.emit(SOCKET_EVENTS.DEAL_STATUS_UPDATE, {
          roomId,
          dealId: latestDeal._id.toString(),
          status: latestDeal.closedDealStatus, // 'completed' | 'rejected'
          dealStatus: latestDeal.dealStatus, // 'accepted'  | 'rejected'
          amount: latestDeal.amount,
        });
      }

      // ✅ Buyer: restore "waiting" state (deal sent, seller hasn't responded yet)
      if (isBuyer && latestDeal.closedDealStatus === 'waiting_seller_approval') {
        socket.emit(SOCKET_EVENTS.DEAL_STATUS_UPDATE, {
          roomId,
          dealId: latestDeal._id.toString(),
          status: 'waiting_seller_approval',
          amount: latestDeal.amount,
        });
      }
    }
  });
  //  Send message ───────────────────────────────────────────
  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async ({ roomId, message, senderType, attachment }) => {
    try {
      const newMsg = {
        senderId: userId,
        senderType,
        message: message || '',
        attachment: attachment || {
          url: null,
          type: null,
          mimeType: null,
          fileName: null,
          fileSize: null,
        },
        timestamp: new Date(),
      };

      const lastMessagePayload = {
        message: message || (attachment?.fileName ?? ''),
        timestamp: newMsg.timestamp,
        senderType,
      };

      const unreadField = senderType === 'buyer' ? 'sellerUnreadCount' : 'buyerUnreadCount';

      const updated = await chatSchema.findOneAndUpdate(
        { roomId },
        {
          $push: { messages: newMsg },
          $set: { lastMessage: lastMessagePayload },
          $inc: { [unreadField]: 1 },
        },
        { new: true }
      );

      if (!updated) {
        console.error(`SEND_MESSAGE: No chat found for roomId="${roomId}"`);
        return;
      }

      // ✅ Broadcast message to everyone IN the room (buyer + seller if both on chat page)
      io.to(roomId).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, {
        roomId,
        message: { ...newMsg, id: Date.now().toString(), text: newMsg.message },
      });

      // ✅ Find the PARTNER's userId to notify their navbar directly
      const partnerId =
        senderType === 'buyer'
          ? updated.sellerId.toString() // buyer sent → notify seller
          : updated.buyerId.toString(); // seller sent → notify buyer

      // ✅ Emit UNREAD_UPDATE to the chat room (for users who have chat open)
      io.to(roomId).emit(SOCKET_EVENTS.UNREAD_UPDATE, {
        roomId,
        field: unreadField,
        lastMessage: lastMessagePayload,
      });

      // ✅ CRITICAL: Also emit directly to partner's personal userId room
      // This is what makes the navbar badge update even when partner is NOT on /chat page
      io.to(partnerId).emit(SOCKET_EVENTS.UNREAD_UPDATE, {
        roomId,
        field: unreadField,
        lastMessage: lastMessagePayload,
      });
    } catch (err) {
      console.error('SEND_MESSAGE error:', err);
    }
  });
  //  Mark messages as read ──────────────────────────────────
  socket.on(SOCKET_EVENTS.MARK_READ, async ({ roomId, readerType }) => {
    const field = readerType === 'buyer' ? 'buyerUnreadCount' : 'sellerUnreadCount';
    await chatSchema.findOneAndUpdate({ roomId }, { $set: { [field]: 0 } });
  });

  // Deal Closure

  socket.on(SOCKET_EVENTS.DEAL_CLOUSER, async payload => {
    try {
      const productBudget = await productSchema
        .findById(payload.productId)
        .select('minimumBudget isSoldProduct')
        .lean();

      const deal = await closeDealSchema.create({
        roomId: payload.roomId,
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        productId: payload.productId,
        amount: payload.amount,
        yourBudget: productBudget?.minimumBudget || 0,
        closedDealStatus: 'waiting_seller_approval',
        dealStatus: 'pending',
        initiator: 'buyer',
      });

      const sellerSocketId = onlineUsers.get(payload.sellerId.toString());
      const dealPayload = {
        dealId: deal._id.toString(),
        amount: payload.amount,
        roomId: payload.roomId,
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
      };

      if (sellerSocketId) {
        // Seller is online — send directly
        io.to(sellerSocketId).emit(SOCKET_EVENTS.PENDING_DEAL, dealPayload);
      }

      socket.emit(SOCKET_EVENTS.DEAL_STATUS_UPDATE, {
        roomId: payload.roomId,
        dealId: deal._id.toString(),
        status: 'waiting_seller_approval',
        amount: payload.amount,
      });
    } catch (err) {
      console.error('DEAL_CLOUSER error:', err);
    }
  });

  // Seller accepts or rejects the deal ──────────────────────────────────
  socket.on(SOCKET_EVENTS.DEAL_APPROVAL, async ({ dealId, action, roomId }) => {
    try {
      if (!['accept', 'reject'].includes(action)) return;

      const newDealStatus = action === 'accept' ? 'accepted' : 'rejected';
      const newClosedDealStatus = action === 'accept' ? 'completed' : 'rejected';

      const updatedDeal = await closeDealSchema.findByIdAndUpdate(
        dealId,
        {
          $set: {
            dealStatus: newDealStatus,
            closedDealStatus: newClosedDealStatus,
            closedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!updatedDeal) return;

      io.to(roomId).emit(SOCKET_EVENTS.DEAL_STATUS_UPDATE, {
        roomId,
        dealId,
        status: newClosedDealStatus,
        dealStatus: newDealStatus,
        amount: updatedDeal.amount,
      });

      // update the product is sold

      await productSchema.findByIdAndUpdate(updatedDeal.productId, {
        $set: {
          isSoldProduct: true,
        },
      });
    } catch (err) {
      console.error('DEAL_APPROVAL error:', err);
    }
  });

  // is Sold Product
  socket.on(SOCKET_EVENTS.PRODUCT_SOLD, async data => {
    const { productId, roomId } = data;
    const product = await productSchema.findById(productId).lean();
    if (product?.isSoldProduct) {
      socket.emit(SOCKET_EVENTS.PRODUCT_SOLD, {
        productId,
        isSoldProduct: true,
      });
    } else {
      socket.emit(SOCKET_EVENTS.PRODUCT_SOLD, {
        productId,
        isSoldProduct: false,
      });
    }
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    onlineUsers.delete(userId);
    io.emit(SOCKET_EVENTS.USER_STATUS, {
      userId,
      isOnline: false,
    });
  });
};
export default chatSocket;

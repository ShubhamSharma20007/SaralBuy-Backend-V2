import { ApiResponse } from '../helpers/ApiReponse.js';
import productSchema from '../models/product.schema.js';
import productNotificaitonSchema from '../models/productNotificaiton.schema.js';

// Backend controller - update getNotifications function
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    let { limit, page, sort } = req.query;

    limit = parseInt(limit) || 10;
    page = parseInt(page) || 1;
    sort = sort === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    // Get notifications where user is recipient
    const query = { recipientId: userId };

    const [notifications, total] = await Promise.all([
      productNotificaitonSchema
        .find(query)
        .populate('productId', 'title')
        .populate('senderId', 'firstName lastName')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: sort }),
      productNotificaitonSchema.countDocuments(query),
    ]);

    return ApiResponse.successResponse(res, 200, 'Notifications fetched successfully', {
      notifications,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    });
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, error.message || 'Something went wrong');
  }
};

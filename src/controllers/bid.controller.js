import { isValidObjectId } from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import bidSchema from '../models/bid.schema.js';
import closeDealSchema from '../models/closeDeal.schema.js';
import productSchema from '../models/product.schema.js';
import requirementSchema from '../models/requirement.schema.js';

export const getLatestThreeBidAndDraft = async (req, res) => {
  try {
    const user = req.user._id;
    if (!user) {
      return ApiResponse.errorResponse(res, 404, 'User not found');
    }
    const bids = await bidSchema
      .find({ sellerId: user })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate({
        path: 'productId',
        populate: {
          path: 'categoryId',
        },
      })
      .lean();
    if (!bids) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    //  for draft
    const drafts = await productSchema
      .find({ userId: user, draft: true })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('categoryId')
      .lean();
    if (!drafts) {
      return ApiResponse.errorResponse(res, 404, 'Draft not found');
    }

    return ApiResponse.successResponse(res, 200, 'Bid fetched successfully', {
      bids,
      drafts,
    });
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 400, 'Something went wrong while getting bid overview');
  }
};
export const bidOverViewbyId = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return ApiResponse.errorResponse(res, 400, 'Invalid bid or product id');
  }

  try {
    const bid = await bidSchema.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },

      {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$product.categoryId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$categoryId'] },
              },
            },
          ],
          as: 'productCategory',
        },
      },
      {
        $unwind: { path: '$productCategory', preserveNullAndEmptyArrays: true },
      },

      {
        $addFields: {
          'product.category': '$productCategory',
        },
      },
      {
        $project: {
          productCategory: 0,
        },
      },
      {
        $addFields: {
          'product.subCategory': {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$product.category.subCategories',
                  as: 'sub',
                  cond: { $eq: ['$$sub._id', '$product.subCategoryId'] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'seller',
        },
      },
      { $unwind: '$seller' },

      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyer',
        },
      },
      { $unwind: '$buyer' },

      {
        $project: {
          productId: 0,
          sellerId: 0,
          buyerId: 0,
          'product.categoryId': 0,
          'product.subCategoryId': 0,
        },
      },
    ]);

    if (!bid.length) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    return ApiResponse.successResponse(res, 200, 'Bid overview', bid[0]);
  } catch (err) {
    return ApiResponse.errorResponse(
      res,
      500,
      err.message || 'Something went wrong while getting bid overview'
    );
  }
};
export const updateBidUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { budgetQuation, availableBrand, earliestDeliveryDate } = req.body;

    const bid = await bidSchema.findByIdAndUpdate(
      id,
      { budgetQuation, availableBrand, earliestDeliveryDate },
      { new: true }
    );

    if (!bid) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    return ApiResponse.successResponse(res, 200, 'Bid updated successfully', bid);
  } catch (err) {
    return ApiResponse.errorResponse(
      res,
      500,
      err.message || 'Something went wrong while updating bid'
    );
  }
};

export const createBid = async (req, res) => {
  try {
    const {
      budgetQuation,
      status,
      availableBrand,
      earliestDeliveryDate,
      businessType,
      sellerType,
      priceBasis,
      taxes,
      freightTerms,
      paymentTerms,
      location,
      buyerNote,
    } = req.body;

    const { buyerId, productId } = req.params;
    const sellerId = req.user.userId;

    if (!isValidObjectId(buyerId) || !isValidObjectId(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid sellerId or productId');
    }

    if (!budgetQuation) {
      return ApiResponse.errorResponse(res, 400, 'budgetQuation is required');
    }

    // Check duplicate bid
    const existingBid = await bidSchema.findOne({ sellerId, buyerId, productId });
    if (existingBid) {
      return ApiResponse.errorResponse(res, 400, 'You have already placed a bid for this product');
    }

    // Check if product already sold
    const isSold = await closeDealSchema.exists({
      productId,
      closedDealStatus: 'completed',
      dealStatus: 'accepted',
    });

    if (Boolean(isSold?._id)) {
      return ApiResponse.errorResponse(res, 400, 'This product is already sold');
    }

    // check in seller is already exisiting in requirement
    const sellerIsExisiitngInRequirement = await requirementSchema.findOne({
      productId,
      buyerId,
      'sellers.sellerId': sellerId,
    });

    if (sellerIsExisiitngInRequirement) {
      return ApiResponse.errorResponse(res, 400, 'You have already placed a bid for this product');
    }

    // Create bid
    const bid = await bidSchema.create({
      sellerId, // who placing bid
      buyerId, // who created this product
      productId,
      budgetQuation,
      status: status || 'active',
      availableBrand,
      earliestDeliveryDate,
      sellerType,
      priceBasis,
      taxes,
      freightTerms,
      paymentTerms,
      location,
      buyerNote,
      businessType,
      ...(businessType === 'business' && {
        businessDets: req.body.businessDets,
      }),
    });

    const updatedProduct = await productSchema.findByIdAndUpdate(
      productId,
      { $inc: { totalBidCount: 1 } },
      { new: true }
    );

    let requirement;
    try {
      let req = await requirementSchema.findOne({ productId, buyerId });

      if (req) {
        const existingSeller = req.sellers.find(s => String(s.sellerId) === String(sellerId));

        if (existingSeller) {
          existingSeller.budgetAmount = budgetQuation;
          existingSeller.bidId = bid._id;
        } else {
          req.sellers.push({
            sellerId,
            budgetAmount: budgetQuation,
            bidId: bid._id,
          });
        }

        await req.save();
        requirement = req;
      } else {
        requirement = await requirementSchema.create({
          productId,
          buyerId,
          sellers: [
            {
              sellerId,
              budgetAmount: budgetQuation,
              bidId: bid._id,
            },
          ],
        });
      }
    } catch (reqError) {
      console.error('Requirement error:', reqError.message);
    }

    // // ✅ Notification
    // let notification = null;
    // try {
    //   const seller = await userSchema
    //     .findById(sellerId)
    //     .select("firstName lastName")
    //     .lean();

    //   const sellerName = seller?.firstName
    //     ? `${seller.firstName} ${seller.lastName || ""}`.trim()
    //     : "A seller";

    //   notification = await productNotificationSchema.create({
    //     userId: updatedProduct.userId,
    //     productId: productId,
    //     title: `New quote on ${updatedProduct.title}`,
    //     description: `${sellerName} placed a quote of ₹${budgetQuation}. Total quotes: ${updatedProduct.totalBidCount}`,
    //     senderId: sellerId,
    //     seen: false,
    //   });
    // } catch (notifError) {
    //   console.error("Notification error:", notifError.message);
    // }

    // Populate bid response
    let populatedBid = bid.toObject();
    try {
      const [sellerDetails, buyerDetails, productDetails] = await Promise.all([
        userSchema.findById(sellerId).select('-password -__v').lean(),
        userSchema.findById(buyerId).select('-password -__v').lean(),
        productSchema.findById(productId).select('title images categoryId').lean(),
      ]);

      populatedBid.seller = sellerDetails;
      populatedBid.buyer = buyerDetails;
      populatedBid.product = productDetails;
    } catch (populateError) {
      console.error('Populate error:', populateError.message);
    }

    return ApiResponse.successResponse(res, 200, 'Bid created successfully', {
      bid: populatedBid,
      productId,
      sellerId,
      buyerId: updatedProduct.userId,
      requirementId: requirement?._id,
      // notification: notification
      //   ? { _id: notification._id, senderId: notification.senderId }
      //   : null,
    });
  } catch (err) {
    return ApiResponse.errorResponse(
      res,
      400,
      err.message || 'Something went wrong while creating bid'
    );
  }
};

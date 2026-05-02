import mongoose from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import requirementSchema from '../models/requirement.schema.js';
import productSchema from '../models/product.schema.js';

export const getRecentRequirements = async (req, res) => {
  try {
    let requirements = await requirementSchema.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'productId',
        },
      },
      { $unwind: '$productId' },
      {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$productId.categoryId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$categoryId'],
                },
              },
            },
          ],
          as: 'productId.categoryId',
        },
      },
      { $unwind: '$productId.categoryId' },
      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyerId',
        },
      },
      { $unwind: '$buyerId' },
      { $sort: { createdAt: -1 } },
      { $limit: 3 },
    ]);

    return ApiResponse.successResponse(res, 200, 'Requirements fetched successfully', requirements);
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 400, 'Something went wrong while getting requirements');
  }
};

export const createRequirement = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { productId, sellerId, buyerId, budgetAmount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid productId or sellerId');
    }
    if (!buyerId || !mongoose.Types.ObjectId.isValid(buyerId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid buyerId');
    }
    if (typeof budgetAmount !== 'number' || isNaN(budgetAmount)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid budgetAmount');
    }

    // check product exists
    const product = await productSchema.findById(productId);
    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    // check if requirement for this product & buyer exists
    let requirement = await requirementSchema.findOne({ productId, buyerId });

    if (requirement) {
      // check if seller already exists in sellers array
      const existingSeller = requirement.sellers.find(s => s.sellerId.toString() === sellerId);

      if (existingSeller) {
        // update budgetAmount if seller already exists
        existingSeller.budgetAmount = budgetAmount;
      } else {
        // add new seller entry
        requirement.sellers.push({ sellerId, budgetAmount });
      }

      await requirement.save();
      return ApiResponse.successResponse(res, 200, 'Requirement updated successfully', requirement);
    } else {
      // create new requirement with sellers array
      requirement = new requirementSchema({
        productId,
        buyerId,
        sellers: [{ sellerId, budgetAmount }],
      });

      await requirement.save();
      return ApiResponse.successResponse(res, 201, 'Requirement created successfully', requirement);
    }
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to create requirement');
  }
};

import { isValidObjectId } from 'mongoose';
import mongoose from 'mongoose';
import uploadFile from '../config/imageKit.config.js';
import { ApiResponse } from '../helpers/ApiReponse.js';
import productSchema from '../models/product.schema.js';
import closeDealSchema from '../models/closeDeal.schema.js';

export const addProduct = async (req, res) => {
  try {
    const image = req.files?.image?.[0];
    const document = req.files?.document?.[0];
    const body = { ...req.body };
    ['paymentAndDelivery', 'oldProductValue'].forEach(key => {
      if (typeof body[key] === 'string') {
        try {
          body[key] = JSON.parse(body[key]);
        } catch {}
      }
    });

    if (Array.isArray(body.subCategoryId)) {
      body.subCategoryId = body.subCategoryId[0];
    }
    let imageUrl = null;
    let documentUrl = null;
    if (image) imageUrl = await uploadFile(image);
    if (document) documentUrl = await uploadFile(document);

    const product = await productSchema.create({
      title: body.title,
      description: body.description,
      quantity: body.quantity,
      minimumBudget: body.minimumBudget ? Number(body.minimumBudget) : undefined,
      brand: body.brand,
      brandName: body.brandName,
      categoryId: body.categoryId,
      subCategoryId: body.subCategoryId,
      userId: req.user._id,
      draft: body.draft === 'true' || body.draft === true,
      image: imageUrl,
      document: documentUrl,
      productType: body.productType,
      oldProductValue: body.oldProductValue,
      conditionOfProduct: body.conditionOfProduct,
      gender: body.gender,
      fuelType: body.fuelType,
      model: body.model,
      color: body.color,
      transmission: body.transmission,
      toolType: body.toolType,
      typeOfProduct: body.typeOfProduct,
      typeOfVehicle: body.typeOfVehicle,
      rateAService: body.rateAService,
      additionalDeliveryAndPackage: body.additionalDeliveryAndPackage,
      paymentAndDelivery: body.paymentAndDelivery,
    });

    return ApiResponse.successResponse(res, 201, 'Product created successfully', product);
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 401, error.message || error, null);
  }
};

export const getTrendingCategory = async (req, res) => {
  try {
    const trendingProducts = await productSchema.aggregate([
      {
        $match: {
          draft: false,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 },
          product: { $first: '$$ROOT' },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $unwind: '$category',
      },

      {
        $project: {
          _id: 0,
          category: {
            _id: '$category._id',
            categoryName: '$category.categoryName',
            image: '$category.image',
          },
          productId: '$product._id',
        },
      },
    ]);
    return ApiResponse.successResponse(res, 200, 'Trending categories', trendingProducts);
  } catch (error) {
    return ApiResponse.errorResponse(
      res,
      400,
      error.message || 'Failed to get trending categories'
    );
  }
};

export const getHomeProducts = async (req, res) => {
  try {
    const topCategories = await productSchema.aggregate([
      { $match: { draft: false } },
      {
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 2 },
    ]);

    const topCategoryIds = topCategories.map(c => c._id);
    const topProductsPerCategory = await productSchema.aggregate([
      {
        $match: {
          categoryId: { $in: topCategoryIds },
          draft: false,
        },
      },
      // Populate category info
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: '$categoryInfo' },

      // Populate user info
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: '$userInfo' },

      {
        $group: {
          _id: '$categoryId',
          categoryName: { $first: '$categoryInfo.categoryName' },
          products: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          _id: 1,
          categoryName: 1,
          products: { $slice: ['$products', 3] },
        },
      },
    ]);

    return ApiResponse.successResponse(
      res,
      200,
      'Products fetched successfully',
      topProductsPerCategory
    );
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message || 'Failed to fetch products');
  }
};

export const getProductByName = async (req, res) => {
  try {
    const { productName } = req.params;
    if (!productName) return ApiResponse.successResponse(res, 200, 'empty query', []);
    const products = await productSchema
      .find(
        {
          title: { $regex: productName, $options: 'i' },
          draft: false,
        },
        {
          title: 1,
          image: 1,
          description: 1,
        }
      )
      .populate({
        path: 'userId',
        select: 'firstName lastName address',
      })
      .populate({
        path: 'categoryId',
        select: 'categoryName',
      })
      .limit(5)
      .lean();
    return ApiResponse.successResponse(res, 200, 'products found', products);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 400, error.message, null);
  }
};

export const searchProductsController = async (req, res) => {
  try {
    const {
      title,
      category,
      categoryId,
      sort,
      min_budget,
      max_budget,
      page = 1,
      limit = 10,
      skip,
    } = req.query;

    const limitValue = Math.max(parseInt(limit, 10), 1);
    const pageValue = Math.max(parseInt(page, 10), 1);
    const skipValue = skip ? parseInt(skip, 10) : (pageValue - 1) * limitValue;

    // ─── Helper: mongoose sort object ────────────────────────────────────────
    const buildSortObj = sort => {
      switch (sort) {
        case 'aplhabetically_a_z':
          return { title: 1 };
        case 'aplhabetically_z_a':
          return { title: -1 };
        case 'feature':
          return { feature: -1, createdAt: -1 };
        // low_to_high / high_to_low handled in-memory (budget is a String field)
        default:
          return { createdAt: -1 };
      }
    };

    // ─── Helper: in-memory price sort (budget stored as String in schema) ────
    const sortByBudget = (docs, direction) =>
      [...docs].sort((a, b) => {
        const aVal = Number(a.budget) || 0;
        const bVal = Number(b.budget) || 0;
        return direction === 'low_to_high' ? aVal - bVal : bVal - aVal;
      });

    // ─── Helper: budget $expr for .find() ────────────────────────────────────
    const buildBudgetExpr = (min, max) => {
      if (!min && !max) return null;
      const conds = [];
      if (min) conds.push({ $gte: [{ $toDouble: '$budget' }, Number(min)] });
      if (max) conds.push({ $lte: [{ $toDouble: '$budget' }, Number(max)] });
      return { $and: conds };
    };

    // ─── Helper: run find + populate ─────────────────────────────────────────
    const fetchProducts = async (filter, sortObj) => {
      const docs = await productSchema
        .find(filter)
        .populate({ path: 'userId', select: 'firstName lastName address' })
        .populate({ path: 'categoryId', select: 'categoryName' })
        .sort(sortObj)
        .skip(skipValue)
        .limit(limitValue)
        .lean();

      return docs;
    };

    // ─── Base filter ──────────────────────────────────────────────────────────
    let filter = { draft: false };
    let useTitleSearch = true;

    const catId = category || categoryId;
    const subCatId = req.query.subCategoryId;

    if (catId) {
      if (!isValidObjectId(catId)) {
        return ApiResponse.errorResponse(res, 400, 'Invalid categoryId');
      }
      filter.categoryId = new mongoose.Types.ObjectId(catId);
      useTitleSearch = false;
    }

    if (subCatId) {
      if (!isValidObjectId(subCatId)) {
        return ApiResponse.errorResponse(res, 400, 'Invalid subCategoryId');
      }
      filter.subCategoryId = new mongoose.Types.ObjectId(subCatId);
      useTitleSearch = false;
    }

    const isPriceSort = sort === 'low_to_high' || sort === 'high_to_low';
    const sortObj = isPriceSort ? { createdAt: -1 } : buildSortObj(sort);

    const budgetExpr = buildBudgetExpr(min_budget, max_budget);
    if (budgetExpr) filter.$expr = budgetExpr;

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH A — Title search
    // ════════════════════════════════════════════════════════════════════════
    if (useTitleSearch) {
      if (!title || typeof title !== 'string' || title.trim().length < 2) {
        return ApiResponse.errorResponse(
          res,
          400,
          'Valid product title is required (min 2 characters)'
        );
      }

      const words = title.trim().split(/\s+/);

      // Strong: all words must match as whole words
      const strongFilter = {
        ...filter,
        $and: words.map(w => ({ title: { $regex: `\\b${w}\\b`, $options: 'i' } })),
      };

      // Weak: any word matches as substring
      const weakFilter = {
        ...filter,
        $or: words.map(w => ({ title: { $regex: w, $options: 'i' } })),
      };

      let products = await fetchProducts(strongFilter, sortObj);
      let total = await productSchema.countDocuments(strongFilter);

      // Fallback to weak filter
      if (products.length === 0) {
        products = await fetchProducts(weakFilter, sortObj);
        total = await productSchema.countDocuments(weakFilter);
      }

      // In-memory price sort (because budget is a String in the schema)
      if (isPriceSort) products = sortByBudget(products, sort);

      return ApiResponse.successResponse(res, 200, 'Products fetched successfully', {
        total,
        totalPages: Math.ceil(total / limitValue),
        page: pageValue,
        limit: limitValue,
        skip: skipValue,
        products,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH B — Category / subCategory search
    // ════════════════════════════════════════════════════════════════════════
    let products = await fetchProducts(filter, sortObj);
    const total = await productSchema.countDocuments(filter);

    if (isPriceSort) products = sortByBudget(products, sort);

    return ApiResponse.successResponse(res, 200, 'Products fetched successfully', {
      total,
      totalPages: Math.ceil(total / limitValue),
      page: pageValue,
      limit: limitValue,
      skip: skipValue,
      products,
    });
  } catch (error) {
    console.error('Error in searchProductsController:', error);
    return ApiResponse.errorResponse(res, 500, 'Internal server error');
  }
};

export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid product ID');
    }
    let product = await productSchema
      .findById(productId)
      .populate({ path: 'userId', select: 'firstName lastName address' })
      .populate({ path: 'categoryId', select: 'categoryName' });

    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    const getStatus = await closeDealSchema
      .findOne({ productId: productId })
      .select('closedDealStatus')
      .lean();

    const dealStatus = getStatus?.closedDealStatus || null;

    const productObj = product.toObject();
    productObj.dealStatus = dealStatus;

    return ApiResponse.successResponse(res, 200, 'Product found', [
      {
        mainProduct: productObj,
      },
    ]);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message);
  }
};

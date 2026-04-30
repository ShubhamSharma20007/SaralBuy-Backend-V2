import { isValidObjectId } from "mongoose";
import mongoose from "mongoose";
import uploadFile from "../config/imageKit.config.js";
import { ApiResponse } from "../helpers/ApiReponse.js";
import productSchema from "../models/product.schema.js";
import closeDealSchema from "../models/closeDeal.schema.js";

export const addProduct = async (req, res) => {
  try {
    const image = req.files?.image?.[0];
    const document = req.files?.document?.[0];
    const body = { ...req.body };
    ["paymentAndDelivery", "oldProductValue"].forEach((key) => {
      if (typeof body[key] === "string") {
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
      minimumBudget: body.minimumBudget
        ? Number(body.minimumBudget)
        : undefined,
      brand: body.brand,
      brandName: body.brandName,
      categoryId: body.categoryId,
      subCategoryId: body.subCategoryId,
      userId: req.user._id,
      draft: body.draft === "true" || body.draft === true,
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

    return ApiResponse.successResponse(
      res,
      201,
      "Product created successfully",
      product,
    );
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
          _id: "$categoryId",
          count: { $sum: 1 },
          product: { $first: "$$ROOT" },
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
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },

      {
        $project: {
          _id: 0,
          category: {
            _id: "$category._id",
            categoryName: "$category.categoryName",
            image: "$category.image",
          },
          productId: "$product._id",
        },
      },
    ]);
    return ApiResponse.successResponse(
      res,
      200,
      "Trending categories",
      trendingProducts,
    );
  } catch (error) {
    return ApiResponse.errorResponse(
      res,
      400,
      error.message || "Failed to get trending categories",
    );
  }
};

export const getHomeProducts = async (req, res) => {
  try {
    const topCategories = await productSchema.aggregate([
      { $match: { draft: false } },
      {
        $group: {
          _id: "$categoryId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 2 },
    ]);

    const topCategoryIds = topCategories.map((c) => c._id);
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
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },

      // Populate user info
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },

      {
        $group: {
          _id: "$categoryId",
          categoryName: { $first: "$categoryInfo.categoryName" },
          products: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 1,
          categoryName: 1,
          products: { $slice: ["$products", 3] },
        },
      },
    ]);

    return ApiResponse.successResponse(
      res,
      200,
      "Products fetched successfully",
      topProductsPerCategory,
    );
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(
      res,
      500,
      error.message || "Failed to fetch products",
    );
  }
};

export const getProductByName = async (req, res) => {
  try {
    const { productName } = req.params;
    if (!productName)
      return ApiResponse.successResponse(res, 200, "empty query", []);
    const products = await productSchema
      .find(
        {
          title: { $regex: productName, $options: "i" },
          draft: false,
        },
        {
          title: 1,
          image: 1,
          description: 1,
        },
      )
      .populate({
        path: "userId",
        select: "firstName lastName address",
      })
      .populate({
        path: "categoryId",
        select: "categoryName",
      })
      .limit(5)
      .lean();
    return ApiResponse.successResponse(res, 200, "products found", products);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 400, error.message, null);
  }
};

export const searchProductsController = async (req, res) => {
  try {
    // Accept both 'category' and 'categoryId' as query params
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

    let filter = { draft: false };
    let useTitleSearch = true;

    // If category or categoryId is present, ignore title and search by categoryId only
    const catId = category || categoryId;
    const subCatId = req.query.subCategoryId;
    if (catId) {
      if (!isValidObjectId(catId)) {
        return ApiResponse.errorResponse(res, 400, "Invalid categoryId");
      }
      filter.categoryId = new mongoose.Types.ObjectId(catId);
      useTitleSearch = false;
    }
    if (subCatId) {
      if (!isValidObjectId(subCatId)) {
        return ApiResponse.errorResponse(res, 400, "Invalid subCategoryId");
      }
      filter.subCategoryId = new mongoose.Types.ObjectId(subCatId);
      useTitleSearch = false;
    }

    // If not searching by category, require title
    if (useTitleSearch) {
      if (!title || typeof title !== "string" || title.trim().length < 2) {
        return ApiResponse.errorResponse(
          res,
          400,
          "Valid product title is required (min 2 characters)",
        );
      }
      const words = title.trim().split(/\s+/);

      // Strong filter: all words as whole words
      const strongFilter = {
        ...filter,
        $and: words.map((word) => ({
          title: { $regex: `\\b${word}\\b`, $options: "i" },
        })),
      };

      // Weak filter: any word as substring
      const weakFilter = {
        ...filter,
        $or: words.map((word) => ({
          title: { $regex: word, $options: "i" },
        })),
      };

      // Budget filter (applies to both strong/weak)
      if (min_budget || max_budget) {
        const budgetCond = {};
        if (min_budget) budgetCond.$gte = Number(min_budget);
        if (max_budget) budgetCond.$lte = Number(max_budget);
        // budget is string in schema, so use $expr to cast
        strongFilter.$expr = {
          $and: [
            ...(min_budget
              ? [{ $gte: [{ $toDouble: "$budget" }, Number(min_budget)] }]
              : []),
            ...(max_budget
              ? [{ $lte: [{ $toDouble: "$budget" }, Number(max_budget)] }]
              : []),
          ],
        };
        weakFilter.$expr = strongFilter.$expr;
      }

      // Sorting
      let sortObj = { createdAt: -1 }; // default: newly_added
      if (sort) {
        switch (sort) {
          case "feature":
            sortObj = { feature: -1, createdAt: -1 }; // assuming 'feature' field exists
            break;
          case "aplhabetically_a_z":
            sortObj = { title: 1 };
            break;
          case "aplhabetically_z_a":
            sortObj = { title: -1 };
            break;
          case "low_to_high":
            sortObj = { $expr: { $toDouble: "$budget" } }; // handled below
            break;
          case "high_to_low":
            sortObj = { $expr: { $toDouble: "$budget" } }; // handled below
            break;
          default:
            sortObj = { createdAt: -1 };
        }
      }

      // Query with strong filter first
      //   let products = await productSchema
      //     .find(strongFilter)
      //     .skip(skipValue)
      //     .limit(limitValue)
      //     .populate({ path: "userId", select: "firstName lastName address" })
      //     .populate({ path: "categoryId", select: "categoryName" })
      //     .sort(
      //       sort === "low_to_high"
      //         ? { $expr: { $toDouble: "$budget" } }
      //         : sort === "high_to_low"
      //           ? { $expr: { $toDouble: "$budget" } }
      //           : sortObj,
      //     );
      let products = await productSchema.aggregate([
        { $match: strongFilter },

        {
          $addFields: {
            budgetNum: { $toDouble: "$budget" },
          },
        },

        {
          $sort:
            sort === "low_to_high"
              ? { budgetNum: 1 }
              : sort === "high_to_low"
                ? { budgetNum: -1 }
                : { createdAt: -1 },
        },

        { $skip: skipValue },
        { $limit: limitValue },
        {
          $lookup: {
            from: "users", // must match your actual MongoDB collection name
            localField: "userId",
            foreignField: "_id",
            as: "userId",
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  address: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: "$userId",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "categoryId",
            pipeline: [
              {
                $project: {
                  categoryName: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: "$categoryId",
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);

      let total = await productSchema.countDocuments(strongFilter);

      // If no products, try weak filter
      if (products.length === 0) {
        products = await productSchema
          .find(weakFilter)
          .skip(skipValue)
          .limit(limitValue)
          .populate({ path: "userId", select: "firstName lastName address" })
          .populate({ path: "categoryId", select: "categoryName" })
          .sort(
            sort === "low_to_high"
              ? { $expr: { $toDouble: "$budget" } }
              : sort === "high_to_low"
                ? { $expr: { $toDouble: "$budget" } }
                : sortObj,
          );
        total = await productSchema.countDocuments(weakFilter);
      }

      // For price sort, sort in-memory if needed (since $expr sort not supported in .sort)
      if (sort === "low_to_high" || sort === "high_to_low") {
        products = products.sort((a, b) => {
          const aBudget = Number(a.budget) || 0;
          const bBudget = Number(b.budget) || 0;
          return sort === "low_to_high" ? aBudget - bBudget : bBudget - aBudget;
        });
      }

      return ApiResponse.successResponse(
        res,
        200,
        "Products fetched successfully",
        {
          total,
          totalPages: Math.ceil(total / limitValue),
          page: pageValue,
          limit: limitValue,
          skip: skipValue,
          products,
        },
      );
    } else {
      // Category search (ignore title)
      // Budget filter
      if (min_budget || max_budget) {
        filter.$expr = {
          $and: [
            ...(min_budget
              ? [{ $gte: [{ $toDouble: "$budget" }, Number(min_budget)] }]
              : []),
            ...(max_budget
              ? [{ $lte: [{ $toDouble: "$budget" }, Number(max_budget)] }]
              : []),
          ],
        };
      }

      // Sorting
      let sortObj = { createdAt: -1 }; // default: newly_added
      if (sort) {
        switch (sort) {
          case "feature":
            sortObj = { feature: -1, createdAt: -1 }; // assuming 'feature' field exists
            break;
          case "aplhabetically_a_z":
            sortObj = { title: 1 };
            break;
          case "aplhabetically_z_a":
            sortObj = { title: -1 };
            break;
          case "low_to_high":
            sortObj = {}; // handled below
            break;
          case "high_to_low":
            sortObj = {}; // handled below
            break;
          default:
            sortObj = { createdAt: -1 };
        }
      }

      let products = await productSchema
        .find(filter)
        .skip(skipValue)
        .limit(limitValue)
        .populate({ path: "userId", select: "firstName lastName address" })
        .populate({ path: "categoryId", select: "categoryName" })
        .sort(
          sort === "low_to_high" ? {} : sort === "high_to_low" ? {} : sortObj,
        );

      let total = await productSchema.countDocuments(filter);

      // For price sort, sort in-memory if needed
      if (sort === "low_to_high" || sort === "high_to_low") {
        products = products.sort((a, b) => {
          const aBudget = Number(a.budget) || 0;
          const bBudget = Number(b.budget) || 0;
          return sort === "low_to_high" ? aBudget - bBudget : bBudget - aBudget;
        });
      }

      return ApiResponse.successResponse(
        res,
        200,
        "Products fetched successfully",
        {
          total,
          totalPages: Math.ceil(total / limitValue),
          page: pageValue,
          limit: limitValue,
          skip: skipValue,
          products,
        },
      );
    }
  } catch (error) {
    console.error("Error in searchProductsController:", error);
    return ApiResponse.errorResponse(res, 500, "Internal server error");
  }
};

export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return ApiResponse.errorResponse(res, 400, "Invalid product ID");
    }
    let product = await productSchema
      .findById(productId)
      .populate({ path: "userId", select: "firstName lastName address" })
      .populate({ path: "categoryId", select: "categoryName" });

    if (!product) {
      return ApiResponse.errorResponse(res, 404, "Product not found");
    }

    const getStatus = await closeDealSchema
      .findOne({ productId: productId })
      .select("closedDealStatus")
      .lean();

    const dealStatus = getStatus?.closedDealStatus || null;

    const productObj = product.toObject();
    productObj.dealStatus = dealStatus;

    return ApiResponse.successResponse(res, 200, "Product found", [
      {
        mainProduct: productObj,
      },
    ]);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message);
  }
};

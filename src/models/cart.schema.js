import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
    ],
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cartItems: [cartItemSchema],
  },
  { timestamps: true }
);

cartSchema.index({ userId: 1, 'cartItems.productIds': 1 }, { unique: true });

export default mongoose.model('Cart', cartSchema);

import express from 'express';
import userRouter from './user.route.js';
import categoryRouter from './category.route.js';
import productRouter from './product.route.js';
import bidRouter from './bid.route.js';
import requirementRouter from './requirement.route.js';
import cartRouter from './cart.route.js';
const router = express.Router();

// const adminRoutes =[
//     {path:"/admin/auth",router:authRoute},
//     {path:"/admin/dashboard",router:dashboardRoute},
//     {path:"/admin/user",router:adminUserRouter},
//     {path:"/admin/bid",router:adminBannerRouter},
//     {path:"/admin/requirement",router:adminRequirementRouter},
// ]

// user routes
const routes = [
  { path: '/category', router: categoryRouter },
  { path: '/product', router: productRouter },
  { path: '/user', router: userRouter },
  { path: '/bid', router: bidRouter },
  { path: '/requirement', router: requirementRouter },
  { path: '/cart', router: cartRouter },
  // {path:'/chat',router:chatRouter},
  // {path:"/banner",router:bannerRouter},
  // ...adminRoutes
];

routes.forEach(route => {
  router.use(route.path, route.router);
});
export default router;

import express from 'express';
import { getRecentRequirements } from '../controllers/requirement.controller.js';
const router = express.Router();

router.get('/recent-requirements', getRecentRequirements);

export default router;

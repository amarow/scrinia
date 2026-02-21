"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const FsController_1 = require("../controllers/FsController");
const router = (0, express_1.Router)();
router.get('/list', FsController_1.FsController.list);
router.post('/pick-directory', FsController_1.FsController.pickDirectory);
exports.default = router;

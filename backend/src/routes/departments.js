const express = require('express');
const Department = require('../models/Department');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await Department.listDepartments());
  } catch (error) {
    next(error);
  }
});

module.exports = router;

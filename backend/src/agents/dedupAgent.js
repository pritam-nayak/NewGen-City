const Complaint = require('../models/Complaint');

async function findDuplicate({ category, title }) {
  return Complaint.findActiveDuplicate(category, title);
}

module.exports = { findDuplicate };

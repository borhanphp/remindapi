const Product = require('../models/Product');
const InventoryBalance = require('../models/InventoryBalance');
const InventoryTransaction = require('../models/InventoryTransaction');
const BatchSerial = require('../models/BatchSerial');
const SaleInvoice = require('../models/SaleInvoice');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const mongoose = require('mongoose');

/**
 * @desc    Get stock valuation report
 * @route   GET /api/inventory-reports/valuation
 * @access  Private
 */
exports.getStockValuationReport = asyncHandler(async (req, res, next) => {
  const { warehouse, category, asOfDate } = req.query;

  if (!req.user || !req.user.organization) {
    return next(new ErrorResponse('User must be part of an organization', 400));
  }

  const userOrgId = req.user.organization._id || req.user.organization;
  const query = { organization: userOrgId };
  if (warehouse) query.warehouse = warehouse;

  const balances = await InventoryBalance.find(query)
    .populate('product', 'name sku category valuationMethod costPrice standardCost')
    .populate('warehouse', 'name code');

  let totalValue = 0;
  const byCategory = {};
  const byWarehouse = {};
  const byValuationMethod = {};
  const items = [];

  for (const balance of balances) {
    if (!balance.product) continue;

    // Filter by category if specified
    if (category && balance.product.category !== category) continue;

    const value = balance.totalValue || (balance.quantity * balance.weightedAverageCost);
    totalValue += value;

    const item = {
      product: {
        _id: balance.product._id,
        name: balance.product.name,
        sku: balance.product.sku,
        category: balance.product.category
      },
      warehouse: balance.warehouse ? {
        _id: balance.warehouse._id,
        name: balance.warehouse.name,
        code: balance.warehouse.code
      } : null,
      quantity: balance.quantity,
      unitCost: balance.weightedAverageCost,
      totalValue: value,
      valuationMethod: balance.product.valuationMethod
    };

    items.push(item);

    // Aggregate by category
    const cat = balance.product.category || 'Uncategorized';
    if (!byCategory[cat]) {
      byCategory[cat] = { quantity: 0, value: 0, items: 0 };
    }
    byCategory[cat].quantity += balance.quantity;
    byCategory[cat].value += value;
    byCategory[cat].items++;

    // Aggregate by warehouse
    if (balance.warehouse) {
      const whId = balance.warehouse._id.toString();
      if (!byWarehouse[whId]) {
        byWarehouse[whId] = {
          name: balance.warehouse.name,
          code: balance.warehouse.code,
          value: 0,
          items: 0
        };
      }
      byWarehouse[whId].value += value;
      byWarehouse[whId].items++;
    }

    // Aggregate by valuation method
    const method = balance.product.valuationMethod;
    if (!byValuationMethod[method]) {
      byValuationMethod[method] = { value: 0, items: 0 };
    }
    byValuationMethod[method].value += value;
    byValuationMethod[method].items++;
  }

  res.status(200).json({
    success: true,
    data: {
      totalValue,
      itemCount: items.length,
      byCategory,
      byWarehouse,
      byValuationMethod,
      items
    }
  });
});

/**
 * @desc    Get stock aging report
 * @route   GET /api/inventory-reports/aging
 * @access  Private
 */
exports.getStockAgingReport = asyncHandler(async (req, res, next) => {
  const { warehouse, category } = req.query;

  if (!req.user || !req.user.organization) {
    return next(new ErrorResponse('User must be part of an organization', 400));
  }

  const userOrgId = req.user.organization._id || req.user.organization;
  const query = { organization: userOrgId };
  if (warehouse) query.warehouse = warehouse;

  const balances = await InventoryBalance.find(query)
    .populate('product', 'name sku category')
    .populate('warehouse', 'name');

  const items = [];
  const agingBuckets = {
    '0-30': { items: 0, value: 0 },
    '31-60': { items: 0, value: 0 },
    '61-90': { items: 0, value: 0 },
    '90+': { items: 0, value: 0 }
  };

  for (const balance of balances) {
    if (!balance.product) continue;
    if (category && balance.product.category !== category) continue;

    const daysOld = balance.daysSinceLastTransaction || 0;
    const value = balance.totalValue;

    let agingBucket;
    if (daysOld <= 30) agingBucket = '0-30';
    else if (daysOld <= 60) agingBucket = '31-60';
    else if (daysOld <= 90) agingBucket = '61-90';
    else agingBucket = '90+';

    agingBuckets[agingBucket].items++;
    agingBuckets[agingBucket].value += value;

    items.push({
      product: {
        _id: balance.product._id,
        name: balance.product.name,
        sku: balance.product.sku,
        category: balance.product.category
      },
      warehouse: balance.warehouse,
      quantity: balance.quantity,
      value: value,
      lastTransactionDate: balance.lastTransactionDate,
      daysOld,
      agingBucket
    });
  }

  // Sort by days old (oldest first)
  items.sort((a, b) => b.daysOld - a.daysOld);

  res.status(200).json({
    success: true,
    data: {
      agingBuckets,
      items
    }
  });
});

/**
 * @desc    Get inventory turnover report
 * @route   GET /api/inventory-reports/turnover
 * @access  Private
 */
exports.getInventoryTurnoverReport = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, warehouse, category } = req.query;

  if (!req.user || !req.user.organization) {
    return next(new ErrorResponse('User must be part of an organization', 400));
  }

  if (!startDate || !endDate) {
    return next(new ErrorResponse('Start date and end date are required', 400));
  }

  const userOrgId = req.user.organization._id || req.user.organization;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  // Get COGS from sales
  const salesQuery = {
    organization: userOrgId,
    invoiceDate: { $gte: start, $lte: end },
    status: { $in: ['paid', 'partially_paid', 'pending'] }
  };

  const sales = await SaleInvoice.aggregate([
    { $match: salesQuery },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalCost: { $sum: { $multiply: ['$items.quantity', '$items.cost'] } },
        quantitySold: { $sum: '$items.quantity' }
      }
    }
  ]);

  // Get average inventory
  const balances = await InventoryBalance.find({
    organization: req.user.organization
  }).populate('product', 'name sku category');

  const salesMap = {};
  sales.forEach(s => {
    salesMap[s._id.toString()] = { totalCost: s.totalCost, quantitySold: s.quantitySold };
  });

  const items = [];

  for (const balance of balances) {
    if (!balance.product) continue;
    if (category && balance.product.category !== category) continue;
    if (warehouse && balance.warehouse.toString() !== warehouse) continue;

    const productId = balance.product._id.toString();
    const saleData = salesMap[productId];

    if (!saleData) continue;

    const avgInventory = balance.totalValue;
    const cogs = saleData.totalCost;
    const turnoverRatio = avgInventory > 0 ? cogs / avgInventory : 0;
    const daysInvOutstanding = turnoverRatio > 0 ? days / turnoverRatio : 0;

    items.push({
      product: {
        _id: balance.product._id,
        name: balance.product.name,
        sku: balance.product.sku,
        category: balance.product.category
      },
      avgInventoryValue: avgInventory,
      cogs,
      quantitySold: saleData.quantitySold,
      turnoverRatio: parseFloat(turnoverRatio.toFixed(2)),
      daysInventoryOutstanding: parseFloat(daysInvOutstanding.toFixed(1)),
      currentQuantity: balance.quantity
    });
  }

  // Sort by turnover ratio
  items.sort((a, b) => b.turnoverRatio - a.turnoverRatio);

  const totalAvgInventory = items.reduce((sum, item) => sum + item.avgInventoryValue, 0);
  const totalCOGS = items.reduce((sum, item) => sum + item.cogs, 0);
  const overallTurnover = totalAvgInventory > 0 ? totalCOGS / totalAvgInventory : 0;

  res.status(200).json({
    success: true,
    data: {
      period: { startDate, endDate, days },
      summary: {
        totalAvgInventory,
        totalCOGS,
        overallTurnover: parseFloat(overallTurnover.toFixed(2))
      },
      items
    }
  });
});

/**
 * @desc    Get stock movement report
 * @route   GET /api/inventory-reports/movement
 * @access  Private
 */
exports.getStockMovementReport = asyncHandler(async (req, res, next) => {
  const { product, warehouse, startDate, endDate, transactionType } = req.query;

  if (!req.user || !req.user.organization) {
    return next(new ErrorResponse('User must be part of an organization', 400));
  }

  if (!startDate || !endDate) {
    return next(new ErrorResponse('Start date and end date are required', 400));
  }

  const userOrgId = req.user.organization._id || req.user.organization;

  const query = {
    organization: userOrgId,
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
  };

  if (product) query.product = product;
  if (warehouse) query.warehouse = warehouse;
  if (transactionType) query.transactionType = transactionType;

  const transactions = await InventoryTransaction.find(query)
    .populate('product', 'name sku unit')
    .populate('warehouse', 'name code')
    .populate('createdBy', 'name')
    .sort({ createdAt: 1 });

  // Group by product
  const byProduct = {};

  transactions.forEach(txn => {
    if (!txn.product) return;

    const prodId = txn.product._id.toString();
    if (!byProduct[prodId]) {
      byProduct[prodId] = {
        product: txn.product,
        openingBalance: txn.previousQuantity - txn.quantity,
        in: 0,
        out: 0,
        closingBalance: 0,
        transactions: []
      };
    }

    if (['purchase', 'adjustment', 'transfer', 'return'].includes(txn.transactionType) && txn.quantity > 0) {
      byProduct[prodId].in += Math.abs(txn.quantity);
    } else {
      byProduct[prodId].out += Math.abs(txn.quantity);
    }

    byProduct[prodId].transactions.push({
      date: txn.createdAt,
      type: txn.transactionType,
      reference: txn.reference,
      quantity: txn.quantity,
      previousQuantity: txn.previousQuantity,
      newQuantity: txn.newQuantity,
      warehouse: txn.warehouse,
      createdBy: txn.createdBy
    });

    byProduct[prodId].closingBalance = txn.newQuantity;
  });

  res.status(200).json({
    success: true,
    data: {
      period: { startDate, endDate },
      products: Object.values(byProduct)
    }
  });
});

/**
 * @desc    Get ABC analysis report
 * @route   GET /api/inventory-reports/abc-analysis
 * @access  Private
 */
exports.getABCAnalysis = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (!req.user || !req.user.organization) {
    return next(new ErrorResponse('User must be part of an organization', 400));
  }

  if (!startDate || !endDate) {
    return next(new ErrorResponse('Start date and end date are required', 400));
  }

  const userOrgId = req.user.organization._id || req.user.organization;

  // Get sales data
  const salesQuery = {
    organization: userOrgId,
    invoiceDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    status: { $in: ['paid', 'partially_paid', 'pending'] }
  };

  const sales = await SaleInvoice.aggregate([
    { $match: salesQuery },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        quantitySold: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  // Get product details
  const productIds = sales.map(s => s._id);
  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = {};
  products.forEach(p => {
    productMap[p._id.toString()] = p;
  });

  // Calculate total revenue
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalRevenue, 0);

  // Assign ABC classification
  let cumulativeRevenue = 0;
  const items = sales.map((sale, index) => {
    cumulativeRevenue += sale.totalRevenue;
    const cumulativePercentage = (cumulativeRevenue / totalRevenue) * 100;

    let classification;
    if (cumulativePercentage <= 70) {
      classification = 'A';
    } else if (cumulativePercentage <= 90) {
      classification = 'B';
    } else {
      classification = 'C';
    }

    const product = productMap[sale._id.toString()];

    return {
      product: product ? {
        _id: product._id,
        name: product.name,
        sku: product.sku,
        category: product.category
      } : null,
      totalRevenue: sale.totalRevenue,
      quantitySold: sale.quantitySold,
      revenuePercentage: (sale.totalRevenue / totalRevenue) * 100,
      cumulativePercentage,
      classification,
      rank: index + 1
    };
  });

  // Summary
  const classA = items.filter(i => i.classification === 'A');
  const classB = items.filter(i => i.classification === 'B');
  const classC = items.filter(i => i.classification === 'C');

  const summary = {
    totalProducts: items.length,
    totalRevenue,
    classA: {
      count: classA.length,
      percentage: (classA.length / items.length) * 100,
      revenue: classA.reduce((sum, i) => sum + i.totalRevenue, 0),
      revenuePercentage: (classA.reduce((sum, i) => sum + i.totalRevenue, 0) / totalRevenue) * 100
    },
    classB: {
      count: classB.length,
      percentage: (classB.length / items.length) * 100,
      revenue: classB.reduce((sum, i) => sum + i.totalRevenue, 0),
      revenuePercentage: (classB.reduce((sum, i) => sum + i.totalRevenue, 0) / totalRevenue) * 100
    },
    classC: {
      count: classC.length,
      percentage: (classC.length / items.length) * 100,
      revenue: classC.reduce((sum, i) => sum + i.totalRevenue, 0),
      revenuePercentage: (classC.reduce((sum, i) => sum + i.totalRevenue, 0) / totalRevenue) * 100
    }
  };

  res.status(200).json({
    success: true,
    data: {
      period: { startDate, endDate },
      summary,
      items
    }
  });
});

/**
 * @desc    Get dead stock report
 * @route   GET /api/inventory-reports/dead-stock
 * @access  Private
 */
exports.getDeadStockReport = asyncHandler(async (req, res, next) => {
  const { days = 90, warehouse } = req.query;

  if (!req.user || !req.user.organization) {
    return next(new ErrorResponse('User must be part of an organization', 400));
  }

  const userOrgId = req.user.organization._id || req.user.organization;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - parseInt(days));

  const query = {
    organization: userOrgId,
    quantity: { $gt: 0 },
    $or: [
      { lastTransactionDate: { $lte: thresholdDate } },
      { lastTransactionDate: { $exists: false } }
    ]
  };

  if (warehouse) query.warehouse = warehouse;

  const balances = await InventoryBalance.find(query)
    .populate('product', 'name sku category costPrice')
    .populate('warehouse', 'name code');

  const items = balances.map(balance => ({
    product: balance.product,
    warehouse: balance.warehouse,
    quantity: balance.quantity,
    value: balance.totalValue,
    lastTransactionDate: balance.lastTransactionDate,
    daysSinceLastTransaction: balance.daysSinceLastTransaction || 999,
    recommendedAction: balance.daysSinceLastTransaction > 180 ? 'Write-off' : 'Clearance Sale'
  }));

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);

  res.status(200).json({
    success: true,
    data: {
      threshold: { days },
      summary: {
        totalItems: items.length,
        totalValue
      },
      items
    }
  });
});

module.exports = exports;


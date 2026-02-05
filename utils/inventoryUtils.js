const mongoose = require('mongoose');
const Product = require('../models/Product');
const InventoryTransaction = require('../models/InventoryTransaction');
const { startSessionWithTransaction, commitTransaction, abortTransaction, endSession } = require('./mongoHelper');

/**
 * Check if sufficient stock is available for a list of items
 * @param {Array} items - Array of items with product and quantity
 * @param {String} warehouseId - Warehouse ID
 * @returns {Object} - Result with availability status and details
 */
async function checkStockAvailability(items, warehouseId) {
  const result = {
    isAvailable: true,
    unavailableItems: [],
    partiallyAvailableItems: []
  };

  for (const item of items) {
    const product = await Product.findById(item.product);
    
    if (!product) {
      throw new Error(`Product not found: ${item.product}`);
    }

    if (product.quantity < item.quantity) {
      result.isAvailable = false;
      
      if (product.quantity > 0) {
        result.partiallyAvailableItems.push({
          product: item.product,
          requested: item.quantity,
          available: product.quantity,
          shortfall: item.quantity - product.quantity
        });
      } else {
        result.unavailableItems.push({
          product: item.product,
          requested: item.quantity,
          available: 0,
          shortfall: item.quantity
        });
      }
    }
  }

  return result;
}

/**
 * Reserve stock for a sales order
 * @param {String} orderId - Sale order ID
 * @param {Array} items - Array of items with product and quantity
 * @param {String} warehouseId - Warehouse ID
 * @param {String} userId - User ID making the reservation
 * @returns {Object} - Reservation result
 */
async function reserveStock(orderId, items, warehouseId, userId) {
  const session = await startSessionWithTransaction();

  try {
    const result = {
      success: true,
      reservedItems: [],
      backorderedItems: []
    };

    for (const item of items) {
      const product = session 
        ? await Product.findById(item.product).session(session)
        : await Product.findById(item.product);
      
      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      if (product.quantity >= item.quantity) {
        // Reserve full quantity
        product.quantity -= item.quantity;
        if (session) {
          await product.save({ session });
        } else {
          await product.save();
        }

        result.reservedItems.push({
          product: item.product,
          quantity: item.quantity
        });

        // Create reservation transaction
        const transactionData = {
          transactionType: 'sale',
          product: item.product,
          warehouse: warehouseId,
          quantity: -item.quantity,
          previousQuantity: product.quantity + item.quantity,
          newQuantity: product.quantity,
          reference: {
            type: 'sale_order',
            id: orderId
          },
          status: 'completed',
          createdBy: userId
        };
        
        if (session) {
          await InventoryTransaction.create([transactionData], { session });
        } else {
          await InventoryTransaction.create(transactionData);
        }
      } else {
        // Create backorder for unavailable quantity
        const availableQty = Math.max(0, product.quantity);
        const backorderQty = item.quantity - availableQty;

        if (availableQty > 0) {
          // Reserve available quantity
          product.quantity = 0;
          if (session) {
            await product.save({ session });
          } else {
            await product.save();
          }

          result.reservedItems.push({
            product: item.product,
            quantity: availableQty
          });

          // Create reservation transaction for available quantity
          const reserveData = {
            transactionType: 'sale',
            product: item.product,
            warehouse: warehouseId,
            quantity: -availableQty,
            previousQuantity: availableQty,
            newQuantity: 0,
            reference: {
              type: 'sale_order',
              id: orderId
            },
            status: 'completed',
            createdBy: userId
          };
          
          if (session) {
            await InventoryTransaction.create([reserveData], { session });
          } else {
            await InventoryTransaction.create(reserveData);
          }
        }

        // Create backorder transaction
        const backorderData = {
          transactionType: 'backorder',
          product: item.product,
          warehouse: warehouseId,
          quantity: backorderQty,
          previousQuantity: 0,
          newQuantity: 0,
          reference: {
            type: 'sale_order',
            id: orderId
          },
          status: 'backordered',
          notes: `Backordered ${backorderQty} units due to insufficient stock`,
          createdBy: userId
        };
        
        if (session) {
          await InventoryTransaction.create([backorderData], { session });
        } else {
          await InventoryTransaction.create(backorderData);
        }

        result.backorderedItems.push({
          product: item.product,
          requested: item.quantity,
          reserved: availableQty,
          backordered: backorderQty
        });
      }
    }

    await commitTransaction(session);
    return result;
  } catch (error) {
    await abortTransaction(session);
    throw error;
  } finally {
    endSession(session);
  }
}

/**
 * Release reserved stock back to inventory
 * @param {String} orderId - Sale order ID
 * @param {Array} items - Array of items with product and quantity
 * @param {String} warehouseId - Warehouse ID
 * @param {String} userId - User ID releasing the stock
 */
async function releaseStock(orderId, items, warehouseId, userId) {
  const session = await startSessionWithTransaction();

  try {
    for (const item of items) {
      const product = session 
        ? await Product.findById(item.product).session(session)
        : await Product.findById(item.product);
      
      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      // Return quantity to stock
      product.quantity += item.quantity;
      if (session) {
        await product.save({ session });
      } else {
        await product.save();
      }

      // Create release transaction
      const transactionData = {
        transactionType: 'adjustment',
        product: item.product,
        warehouse: warehouseId,
        quantity: item.quantity,
        previousQuantity: product.quantity - item.quantity,
        newQuantity: product.quantity,
        reference: {
          type: 'sale_order',
          id: orderId
        },
        status: 'completed',
        notes: 'Released reserved stock',
        createdBy: userId
      };
      
      if (session) {
        await InventoryTransaction.create([transactionData], { session });
      } else {
        await InventoryTransaction.create(transactionData);
      }
    }

    await commitTransaction(session);
  } catch (error) {
    await abortTransaction(session);
    throw error;
  } finally {
    endSession(session);
  }
}

module.exports = {
  checkStockAvailability,
  reserveStock,
  releaseStock
}; 
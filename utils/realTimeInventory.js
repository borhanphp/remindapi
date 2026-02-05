const mongoose = require('mongoose');
const Product = require('../models/Product');

// Constants
const RESERVATION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_RETRIES = 3;

/**
 * Create a temporary reservation for products
 * @param {String} orderId - Sale order ID
 * @param {Array} items - Array of items with product and quantity
 * @returns {Object} - Result with reservation status and details
 */
async function createTemporaryReservation(orderId, items) {
  try {
    const result = {
      success: true,
      reservedItems: [],
      unavailableItems: []
    };

    const expiresAt = new Date(Date.now() + RESERVATION_TIMEOUT);

    for (const item of items) {
      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        const product = await Product.findById(item.product);
        
        if (!product) {
          throw new Error(`Product not found: ${item.product}`);
        }

        // Calculate current available quantity
        const availableQty = product.availableQuantity;

        if (availableQty >= item.quantity) {
          // Add temporary reservation
          product.temporaryReservations.push({
            orderId,
            quantity: item.quantity,
            expiresAt
          });

          try {
            await product.save();
            success = true;
            result.reservedItems.push({
              product: item.product,
              quantity: item.quantity,
              expiresAt
            });
          } catch (err) {
            if (err.name === 'VersionError') {
              retries++;
              continue;
            }
            throw err;
          }
        } else {
          result.success = false;
          result.unavailableItems.push({
            product: item.product,
            requested: item.quantity,
            available: availableQty
          });
          break;
        }
      }

      if (!success && retries === MAX_RETRIES) {
        throw new Error(`Failed to reserve product ${item.product} after ${MAX_RETRIES} attempts`);
      }
    }

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Convert temporary reservations to permanent inventory deductions
 * @param {String} orderId - Sale order ID
 * @returns {Object} - Result with conversion status and details
 */
async function convertReservationToPermanent(orderId) {
  try {
    // Find all products with temporary reservations for this order
    const products = await Product.find({
      'temporaryReservations.orderId': orderId
    });

    for (const product of products) {
      const reservation = product.temporaryReservations.find(r => r.orderId === orderId);
      
      if (reservation) {
        // Remove the temporary reservation
        product.temporaryReservations = product.temporaryReservations.filter(r => r.orderId !== orderId);
        
        // Deduct from actual quantity
        product.quantity -= reservation.quantity;
        
        await product.save();
      }
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Release temporary reservations for an order
 * @param {String} orderId - Sale order ID
 */
async function releaseTemporaryReservation(orderId) {
  try {
    // Find all products with temporary reservations for this order
    const products = await Product.find({
      'temporaryReservations.orderId': orderId
    });

    for (const product of products) {
      // Remove the temporary reservation
      product.temporaryReservations = product.temporaryReservations.filter(r => r.orderId !== orderId);
      await product.save();
    }

  } catch (error) {
    throw error;
  }
}

/**
 * Cleanup expired reservations
 */
async function cleanupExpiredReservations() {
  try {
    const now = new Date();
    
    // Find all products with expired reservations
    const products = await Product.find({
      'temporaryReservations.expiresAt': { $lt: now }
    });

    for (const product of products) {
      // Remove expired reservations
      product.temporaryReservations = product.temporaryReservations.filter(r => r.expiresAt > now);
      await product.save();
    }
  } catch (error) {
    throw error;
  }
}

module.exports = {
  createTemporaryReservation,
  convertReservationToPermanent,
  releaseTemporaryReservation,
  cleanupExpiredReservations
}; 
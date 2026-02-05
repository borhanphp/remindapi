const mongoose = require('mongoose');

/**
 * Check if MongoDB supports transactions (replica set or sharded cluster)
 * @returns {boolean} - True if transactions are supported
 */
function supportsTransactions() {
  try {
    const topology = mongoose.connection.getClient().topology;
    
    // Check if it's a replica set or sharded cluster
    if (topology && topology.description) {
      const type = topology.description.type;
      return type === 'ReplicaSetWithPrimary' || type === 'Sharded';
    }
    
    return false;
  } catch (err) {
    console.log('Could not determine MongoDB topology, assuming standalone:', err.message);
    return false;
  }
}

/**
 * Start a session with transaction if supported, or return null
 * @returns {Promise<Session|null>} - Session object or null if not supported
 */
async function startSessionWithTransaction() {
  if (!supportsTransactions()) {
    console.log('MongoDB transactions not supported (standalone mode)');
    return null;
  }
  
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    return session;
  } catch (err) {
    console.log('Failed to start transaction:', err.message);
    return null;
  }
}

/**
 * Commit transaction if session exists
 * @param {Session|null} session 
 */
async function commitTransaction(session) {
  if (session) {
    await session.commitTransaction();
  }
}

/**
 * Abort transaction if session exists
 * @param {Session|null} session 
 */
async function abortTransaction(session) {
  if (session) {
    await session.abortTransaction();
  }
}

/**
 * End session if exists
 * @param {Session|null} session 
 */
function endSession(session) {
  if (session) {
    session.endSession();
  }
}

module.exports = {
  supportsTransactions,
  startSessionWithTransaction,
  commitTransaction,
  abortTransaction,
  endSession
};


let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

function emit(event, payload) {
  try {
    if (ioInstance) {
      ioInstance.emit(event, payload);
    }
  } catch (e) {
    // noop
  }
}

module.exports = { setIO, getIO, emit };



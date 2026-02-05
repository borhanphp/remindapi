const mongoose = require('mongoose');

const POSDeviceSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    deviceType: {
      type: String,
      enum: ['scanner', 'printer', 'drawer', 'display', 'scale'],
      required: true
    },
    deviceName: {
      type: String,
      required: true,
      trim: true
    },
    deviceId: {
      type: String,
      unique: true,
      sparse: true
    },
    deviceConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Scanner config
    scannerConfig: {
      type: {
        type: String,
        enum: ['keyboard_wedge', 'usb_hid', 'bluetooth']
      },
      barcodePrefix: String,
      barcodeSuffix: String,
      timeout: Number
    },
    // Printer config
    printerConfig: {
      type: {
        type: String,
        enum: ['usb', 'network', 'bluetooth', 'serial']
      },
      connectionString: String,
      ipAddress: String,
      port: Number,
      paperWidth: Number,
      encoding: {
        type: String,
        default: 'utf-8'
      }
    },
    // Cash drawer config
    drawerConfig: {
      triggerMethod: {
        type: String,
        enum: ['printer', 'usb', 'serial']
      },
      openDuration: {
        type: Number,
        default: 100
      }
    },
    // Customer display config
    displayConfig: {
      type: {
        type: String,
        enum: ['serial', 'usb', 'network']
      },
      connectionString: String,
      lines: {
        type: Number,
        default: 2
      }
    },
    // Weighing scale config
    scaleConfig: {
      type: {
        type: String,
        enum: ['serial', 'usb']
      },
      connectionString: String,
      baudRate: Number,
      unit: {
        type: String,
        enum: ['kg', 'lb', 'g', 'oz']
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastConnected: {
      type: Date
    },
    lastTested: {
      type: Date
    },
    testResult: {
      success: Boolean,
      message: String,
      testedAt: Date
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot be more than 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// Indexes
POSDeviceSchema.index({ organization: 1, warehouse: 1, deviceType: 1 });
POSDeviceSchema.index({ deviceId: 1 });
POSDeviceSchema.index({ isActive: 1 });

module.exports = mongoose.model('POSDevice', POSDeviceSchema);


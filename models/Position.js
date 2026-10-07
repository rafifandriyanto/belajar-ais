/**
 * models/Position.js - Model Mongoose untuk Riwayat Posisi Kapal AIS
 */

const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  mmsi: {
    type: String,
    required: true,
    index: true
  },
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  },
  speed: {
    type: Number,
    required: true
  },
  heading: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Position', positionSchema);

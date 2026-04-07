'use strict';

const { saveSubscription, removeSubscription } = require('../services/push');

// @POST /api/push/subscribe
const subscribe = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    const userAgent = req.headers['user-agent'] || '';
    await saveSubscription(req.user._id, subscription, userAgent);

    res.status(201).json({ message: 'Subscribed to push notifications' });
  } catch (err) {
    next(err);
  }
};

// @DELETE /api/push/unsubscribe
const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: 'Endpoint required' });

    await removeSubscription(endpoint);
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    next(err);
  }
};

// @GET /api/push/vapid-public-key
const getVapidKey = (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

module.exports = { subscribe, unsubscribe, getVapidKey };
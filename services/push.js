'use strict';

const webpush           = require('web-push');
const PushSubscription  = require('../models/pushSubscription');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Save or update a push subscription for a user.
 */
const saveSubscription = async (userId, subscription, userAgent = '') => {
  await PushSubscription.findOneAndUpdate(
    { user: userId, 'subscription.endpoint': subscription.endpoint },
    { user: userId, subscription, userAgent },
    { upsert: true, new: true }
  );
};

/**
 * Remove a subscription (user unsubscribed or browser revoked).
 */
const removeSubscription = async (endpoint) => {
  await PushSubscription.deleteOne({ 'subscription.endpoint': endpoint });
};

/**
 * Send a push notification to all subscriptions for a user.
 * Silently removes expired/invalid subscriptions.
 */
const sendPushToUser = async (userId, payload) => {
  const subs = await PushSubscription.find({ user: userId });
  if (!subs.length) return;

  const json = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (doc) => {
      try {
        await webpush.sendNotification(doc.subscription, json);
      } catch (err) {
        // 404 / 410 = subscription expired or unsubscribed
        if (err.statusCode === 404 || err.statusCode === 410) {
          await removeSubscription(doc.subscription.endpoint);
        }
      }
    })
  );
};

module.exports = { saveSubscription, removeSubscription, sendPushToUser };
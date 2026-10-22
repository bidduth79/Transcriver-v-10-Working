/**
 * Firebase Throttled Background Sync Queue (Batch-Aware Sync Lock & Zero-RAM Queue)
 * 
 * আধুনিক আর্কিটেকচার (Modern Batch-Aware Sync Lock):
 * ১. যতক্ষণ কোনো সিঙ্গেল ট্রান্সক্রিপশন বা ব্যাচ প্রসেসিং (Batch Processing) চলবে,
 *    ততক্ষণ ফায়ারবেইজ সিঙ্ক ১০০% পজ/লক (Paused) থাকবে—যাতে অডিও এনকোডিং ও নেটওয়ার্কের সাথে কখনোই সংঘর্ষ না হয়।
 * ২. কিউতে (queueMap) বিশাল ট্রান্সক্রিপ্ট টেক্সট মেমোরিতে ধরে না রেখে শুধুমাত্র ছোট ID স্ট্রিং রাখা হয় (Zero RAM Overhead)।
 * ৩. পুরো ব্যাচ বা ট্রান্সক্রিপশন সম্পূর্ণ শেষ হওয়ার ৮ সেকেন্ড পর, যখন ব্রাউজার ১০০% ফ্রি থাকে,
 *    তখন লোকাল IndexedDB থেকে ১টি করে ডাটা পড়ে ২.৫ সেকেন্ড বিরতি দিয়ে নিঃশব্দে ফায়ারবেইজে পাঠায়।
 */

// Public entry point; implementation lives in services/firebaseSync/.
export { subscribeFirebaseSyncStats, getFirebaseSyncStats } from './firebaseSync/syncState';
export type { FirebaseGentleSyncStats } from './firebaseSync/syncState';
export { setHeavyProcessingActive, enqueueFirebaseWrite, enqueueFirebaseDelete } from './firebaseSync/pushQueue';
export { scheduleGentleFirebasePull } from './firebaseSync/gentlePull';

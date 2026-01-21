const express = require('express');
const client = require('prom-client');
const fs = require('fs');
const path = require('path');
let admin;

try {
  admin = require('firebase-admin');
} catch (e) {
  admin = null;
}

const app = express();
const register = client.register;

const FACILITIES_FILE = path.join(__dirname, '..', 'sport_facilities', 'facilities_data.json');

// Metrics
const facilityReviewGauge = new client.Gauge({
  name: 'facility_review_count',
  help: 'Number of reviews for facility',
  labelNames: ['facility']
});

const facilityRatingGauge = new client.Gauge({
  name: 'facility_average_rating',
  help: 'Average rating for facility',
  labelNames: ['facility']
});

const facilityFavoritesGauge = new client.Gauge({
  name: 'facility_favorites_count',
  help: 'Favorites count for facility',
  labelNames: ['facility']
});

const facilityTopGauge = new client.Gauge({
  name: 'facility_top_rating',
  help: 'Average rating for facility, exported only for facilities with the maximum rating',
  labelNames: ['facility']
});

const userReviewGauge = new client.Gauge({
  name: 'user_review_count',
  help: 'Number of reviews by user',
  labelNames: ['user']
});

const userTopGauge = new client.Gauge({
  name: 'user_top_reviews',
  help: 'Review count for user(s) with the maximum number of reviews',
  labelNames: ['user']
});

const totalFacilities = new client.Gauge({
  name: 'minicoders_total_facilities',
  help: 'Total number of facilities in dataset'
});

const totalUsers = new client.Gauge({
  name: 'minicoders_total_users',
  help: 'Total number of users in dataset'
});

let firestore = null;

function tryInitFirebase() {
  if (!admin) return false;

  // Accept either a path to a service account JSON or the JSON itself in env
  const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    let creds;
    if (svcJson) {
      creds = JSON.parse(svcJson);
      admin.initializeApp({ credential: admin.credential.cert(creds) });
    } else if (svcPath && fs.existsSync(svcPath)) {
      creds = require(svcPath);
      admin.initializeApp({ credential: admin.credential.cert(creds) });
    } else {
      return false;
    }

    firestore = admin.firestore();
    console.log('Initialized Firebase Admin SDK for Firestore');
    return true;
  } catch (e) {
    console.error('Failed to initialize Firebase Admin SDK:', e.message || e);
    return false;
  }
}

async function loadFromFirestore() {
  if (!firestore) return false;

  try {
    // Load facilities
    const facSnap = await firestore.collection('facilities').get();
    const facilities = [];
    facSnap.forEach(d => facilities.push({ id: d.id, ...(d.data() || {}) }));

    // Load reviews and aggregate by facility and user
    const reviewsSnap = await firestore.collection('reviews').get();
    const reviewCounts = {}; // facilityName -> count
    const ratingSums = {}; // facilityName -> sum
    const userCounts = {}; // userName or userId -> count

    reviewsSnap.forEach(d => {
      const r = d.data();
      const facilityId = r.facilityId || r.facility || 'unknown';
      const rating = Number(r.rating || 0);
      const userKey = r.userName || r.userId || 'anonymous';

      // find facility name from facilities list
      const f = facilities.find(x => x.facilityId === facilityId || x.id === facilityId || x.name === facilityId);
      const fname = (f && f.name) ? f.name : facilityId;

      reviewCounts[fname] = (reviewCounts[fname] || 0) + 1;
      ratingSums[fname] = (ratingSums[fname] || 0) + rating;

      userCounts[userKey] = (userCounts[userKey] || 0) + 1;
    });

    // Count favorites by scanning users collection for favorites arrays
    const usersSnap = await firestore.collection('users').get();
    const favCounts = {}; // facilityName -> count
    let userCount = 0;
    usersSnap.forEach(d => {
      userCount += 1;
      const u = d.data();
      const favs = u.favorites || u.favoriteFacilityIds || [];
      favs.forEach(facId => {
        const f = facilities.find(x => x.facilityId === facId || x.id === facId || x.name === facId);
        const fname = (f && f.name) ? f.name : facId;
        favCounts[fname] = (favCounts[fname] || 0) + 1;
      });
    });

    // set total users metric
    try { totalUsers.set(userCount); } catch (e) {}

    // Set metrics
    totalFacilities.set(facilities.length);


    // set per-facility metrics
    const avgs = [];
    facilities.forEach(f => {
      const name = f.name || f.id || 'unknown';
      const reviewCount = reviewCounts[name] || Number(f.reviewCount || 0) || 0;
      const sum = ratingSums[name] || 0;
      const avg = reviewCount > 0 ? Number((sum / reviewCount).toFixed(2)) : Number(f.averageRating || 0) || 0;
      const fav = favCounts[name] || Number(f.favorites || 0) || 0;

      facilityReviewGauge.set({ facility: name }, reviewCount);
      facilityRatingGauge.set({ facility: name }, avg);
      facilityFavoritesGauge.set({ facility: name }, fav);
      avgs.push({ name, avg });
    });

    // compute max average and expose facility_top_rating only for those with max
    const maxAvg = avgs.reduce((m, x) => (x.avg > m ? x.avg : m), -Infinity);
    console.log('Computed avgs:', JSON.stringify(avgs));
    console.log('Computed maxAvg:', maxAvg);
    avgs.forEach(x => {
      if (Number(x.avg) === Number(maxAvg) && !Number.isNaN(x.avg)) {
        // set to avg so panel can show rating value
        facilityTopGauge.set({ facility: x.name }, x.avg);
        console.log('Setting top metric for', x.name, '=>', x.avg);
      } else {
        // remove any previous label for non-top facilities
        try {
          facilityTopGauge.remove({ facility: x.name });
        } catch (e) {
          // ignore
        }
      }
    });

    // set user metrics
    Object.keys(userCounts).forEach(u => {
      userReviewGauge.set({ user: u }, userCounts[u]);
    });

    // ensure totalUsers is set even if no users found
    if (!firestore) {
      try { totalUsers.set(0); } catch (e) {}
    }

    // compute top user(s)
    const userEntries = Object.keys(userCounts).map(u => ({ user: u, count: userCounts[u] }));
    if (userEntries.length > 0) {
      const maxCount = userEntries.reduce((m, x) => (x.count > m ? x.count : m), -Infinity);
      userEntries.forEach(x => {
        if (x.count === maxCount) {
          userTopGauge.set({ user: x.user }, x.count);
        } else {
          try { userTopGauge.remove({ user: x.user }); } catch (e) {}
        }
      });
    }

    return true;
  } catch (e) {
    console.error('Error loading data from Firestore:', e.message || e);
    return false;
  }
}

function loadFromJson() {
  let data = [];
  try {
    const raw = fs.readFileSync(FACILITIES_FILE, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read facilities file:', e.message);
    return;
  }

  totalFacilities.set(data.length);
  data.forEach((f) => {
    const name = f.name || 'unknown';
    const reviewCount = Number(f.reviewCount || 0);
    const avg = Number(f.averageRating || 0);
    const favorites = Number(f.favorites || 0);

    facilityReviewGauge.set({ facility: name }, reviewCount);
    facilityRatingGauge.set({ facility: name }, avg);
    facilityFavoritesGauge.set({ facility: name }, favorites);
  });
}

async function loadAndUpdateMetrics() {
  // try Firestore if configured
  const inited = firestore || tryInitFirebase();
  if (inited) {
    const ok = await loadFromFirestore();
    if (ok) return;
  }

  // fallback to JSON file
  loadFromJson();
}

// Update every 15s
loadAndUpdateMetrics();
setInterval(loadAndUpdateMetrics, 15000);

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 9100;
app.listen(PORT, () => {
  console.log(`Metrics exporter listening on http://localhost:${PORT}`);
});

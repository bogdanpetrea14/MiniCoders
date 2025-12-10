import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const facilityId = urlParams.get('id');

const facilityName = document.getElementById('facilityName');
const facilityType = document.getElementById('facilityType');
const facilityAddress = document.getElementById('facilityAddress');
const facilityHours = document.getElementById('facilityHours');
const facilityRating = document.getElementById('facilityRating');
const facilityDescription = document.getElementById('facilityDescription');
const reviewsList = document.getElementById('reviewsList');
const reviewForm = document.getElementById('reviewForm');
const addReviewContainer = document.getElementById('addReviewContainer');

// Load Facility Data
async function loadFacilityDetails() {
    if (!facilityId) return;

    // NOTE: In a real scenario, we would query Firestore for the facility details using the ID.
    // However, since the facility data primarily lives in the ArcGIS Feature Layer for now,
    // we might need to query the Feature Layer or have a synced document in Firestore.
    // For this demo (Task 4), we will assume there is a Firestore document or mock it if not found.

    try {
        const docRef = doc(db, "facilities", facilityId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            facilityName.textContent = data.name;
            facilityType.textContent = data.type;
            facilityAddress.textContent = data.address;
            facilityHours.textContent = data.openedHours || "N/A";
            facilityRating.textContent = `★ ${data.averageRating || 0}`;
            facilityDescription.textContent = data.description || "Fără descriere.";
        } else {
            // Mock data if not found (since we haven't populated DB yet)
            console.log("No such document in Firestore! Using mock data.");
            facilityName.textContent = "Facilitate Demo";
            facilityType.textContent = "Fotbal";
            facilityAddress.textContent = "Strada Demo 123";
            facilityDescription.textContent = "Aceasta este o facilitate demonstrativă deoarece nu există date în baza de date.";
        }
    } catch (error) {
        console.error("Error getting document:", error);
    }
}

// Load Reviews
async function loadReviews() {
    if (!facilityId) return;

    const q = query(collection(db, "reviews"), where("facilityId", "==", facilityId));
    const querySnapshot = await getDocs(q);

    reviewsList.innerHTML = '';
    if (querySnapshot.empty) {
        reviewsList.innerHTML = '<p>Nu există recenzii încă.</p>';
        return;
    }

    querySnapshot.forEach((doc) => {
        const review = doc.data();
        const reviewEl = document.createElement('div');
        reviewEl.className = 'review-card';
        reviewEl.innerHTML = `
            <div class="review-header">
                <strong>Utilizator</strong>
                <span class="rating">★ ${review.rating}</span>
            </div>
            <p>${review.comment}</p>
        `;
        reviewsList.appendChild(reviewEl);
    });
}

// Handle Add Review
if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = document.getElementById('rating').value;
        const comment = document.getElementById('comment').value;
        const user = auth.currentUser;

        if (!user) {
            alert("Trebuie să fii autentificat pentru a lăsa o recenzie.");
            return;
        }

        try {
            await addDoc(collection(db, "reviews"), {
                facilityId: facilityId,
                userId: user.uid,
                rating: parseInt(rating),
                comment: comment,
                createdAt: new Date()
            });
            alert("Recenzie adăugată!");
            reviewForm.reset();
            loadReviews(); // Reload reviews
        } catch (error) {
            console.error("Error adding review: ", error);
            alert("Eroare la adăugarea recenziei.");
        }
    });
}

// Check Auth for Review Form
onAuthStateChanged(auth, (user) => {
    if (user) {
        addReviewContainer.style.display = 'block';
    } else {
        addReviewContainer.style.display = 'none';
    }
});

// Initialize
if (facilityId) {
    loadFacilityDetails();
    loadReviews();
} else {
    document.querySelector('.details-container').innerHTML = '<p>ID facilitate lipsă.</p>';
}

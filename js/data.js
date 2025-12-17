import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// Load Facility Details
async function loadFacilityDetails() {
    if (!facilityId) return;

    try {
        const docRef = doc(db, "facilities", facilityId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            facilityName.textContent = data.name;
            facilityType.textContent = data.type + (data.priceLevel ? ` (${data.priceLevel})` : "");
            facilityAddress.textContent = data.address;
            facilityHours.textContent = data.openedHours || "08:00 - 22:00";
            facilityRating.textContent = `★ ${data.averageRating || "N/A"}`;
            facilityDescription.textContent = data.description || "Fără descriere.";
        } else {
            document.querySelector('.details-container').innerHTML = "<h2>Facilitatea nu a fost găsită!</h2>";
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
        // Convert timestamp to date string if it exists
        const dateStr = review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : '';
        
        reviewEl.innerHTML = `
            <div class="review-header">
                <strong>${review.userName || 'Utilizator'}</strong>
                <span class="rating">★ ${review.rating}</span>
            </div>
            <p>${review.comment}</p>
            <small style="color:#999">${dateStr}</small>
        `;
        reviewsList.appendChild(reviewEl);
    });
}

// Handle Add Review
if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = parseInt(document.getElementById('rating').value);
        const comment = document.getElementById('comment').value;
        const user = auth.currentUser;

        if (!user) {
            alert("Trebuie să fii autentificat!");
            return;
        }

        try {
            // 1. Add review
            await addDoc(collection(db, "reviews"), {
                facilityId: facilityId,
                userId: user.uid,
                userName: user.displayName || "Anonim",
                rating: rating,
                comment: comment,
                createdAt: new Date()
            });

            // 2. Update Average Rating in Facility (Optional but recommended)
            // This is a simplified calculation. Ideally done via Cloud Functions.
            const docRef = doc(db, "facilities", facilityId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const oldTotal = (data.averageRating || 0) * (data.reviewCount || 0);
                const newCount = (data.reviewCount || 0) + 1;
                const newAvg = (oldTotal + rating) / newCount;

                await updateDoc(docRef, {
                    averageRating: parseFloat(newAvg.toFixed(1)),
                    reviewCount: newCount
                });
            }

            alert("Recenzie adăugată!");
            reviewForm.reset();
            loadReviews(); // Reload reviews list
            loadFacilityDetails(); // Reload rating header
        } catch (error) {
            console.error("Error adding review: ", error);
            alert("Eroare la adăugarea recenziei.");
        }
    });
}

// Check Auth Visibility
onAuthStateChanged(auth, (user) => {
    if (user) {
        addReviewContainer.style.display = 'block';
    } else {
        addReviewContainer.style.display = 'none';
    }
});

// Init
if (facilityId) {
    loadFacilityDetails();
    loadReviews();
}
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const myReviewsList = document.getElementById('myReviewsList');

// Load user profile data
async function loadUserProfile(user) {
    try {
        // Get user data from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            userNameEl.textContent = userData.displayName || user.displayName || "Utilizator";
        } else {
            // If user document doesn't exist, use auth data
            userNameEl.textContent = user.displayName || "Utilizator";
        }
        
        userEmailEl.textContent = user.email || "N/A";
    } catch (error) {
        console.error("Error loading user profile:", error);
        userNameEl.textContent = user.displayName || "Utilizator";
        userEmailEl.textContent = user.email || "N/A";
    }
}

// Load user's reviews
async function loadMyReviews(userId) {
    try {
        const q = query(collection(db, "reviews"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        myReviewsList.innerHTML = '';

        if (querySnapshot.empty) {
            myReviewsList.innerHTML = '<p class="no-reviews">Nu ai scris încă niciun review.</p>';
            return;
        }

        // Get facility names for each review
        const reviewsWithFacilities = await Promise.all(
            querySnapshot.docs.map(async (reviewDoc) => {
                const review = reviewDoc.data();
                const reviewId = reviewDoc.id;
                
                // Get facility name
                let facilityName = "Facilitate necunoscută";
                try {
                    const facilityDocRef = doc(db, "facilities", review.facilityId);
                    const facilityDocSnap = await getDoc(facilityDocRef);
                    if (facilityDocSnap.exists()) {
                        facilityName = facilityDocSnap.data().name || facilityName;
                    }
                } catch (error) {
                    console.error("Error loading facility:", error);
                }

                return {
                    id: reviewId,
                    facilityId: review.facilityId,
                    facilityName: facilityName,
                    rating: review.rating,
                    comment: review.comment,
                    createdAt: review.createdAt
                };
            })
        );

        // Sort by date (newest first)
        reviewsWithFacilities.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

        // Display reviews
        reviewsWithFacilities.forEach((review) => {
            const reviewEl = document.createElement('div');
            reviewEl.className = 'review-card profile-review-card';
            
            // Convert timestamp to date string
            let dateStr = '';
            if (review.createdAt) {
                if (review.createdAt.seconds) {
                    dateStr = new Date(review.createdAt.seconds * 1000).toLocaleDateString('ro-RO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } else if (review.createdAt instanceof Date) {
                    dateStr = review.createdAt.toLocaleDateString('ro-RO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            }

            reviewEl.innerHTML = `
                <div class="review-header">
                    <div>
                        <strong><a href="details.html?id=${review.facilityId}" class="facility-link">${review.facilityName}</a></strong>
                        <span class="rating">★ ${review.rating}</span>
                    </div>
                    <small style="color:#999">${dateStr}</small>
                </div>
                <p>${review.comment}</p>
            `;

            myReviewsList.appendChild(reviewEl);
        });

    } catch (error) {
        console.error("Error loading reviews:", error);
        myReviewsList.innerHTML = '<p class="error-message">Eroare la încărcarea review-urilor.</p>';
    }
}

// Check authentication and load data
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserProfile(user);
        loadMyReviews(user.uid);
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'auth.html';
    }
});


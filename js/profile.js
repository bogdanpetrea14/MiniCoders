import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const myReviewsList = document.getElementById('myReviewsList');
const myFavoritesList = document.getElementById('myFavoritesList');

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

// Custom Confirm Modal Helper
function showConfirmationModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("customConfirmModal");
        const msgEl = document.getElementById("customConfirmMessage");
        const btnYes = document.getElementById("btnConfirmYes");
        const btnNo = document.getElementById("btnConfirmNo");

        if (!modal || !msgEl || !btnYes || !btnNo) {
            resolve(confirm(message));
            return;
        }

        msgEl.textContent = message;
        modal.classList.add("show");

        const cleanup = () => {
            modal.classList.remove("show");
            btnYes.removeEventListener("click", onYes);
            btnNo.removeEventListener("click", onNo);
        };

        const onYes = () => {
            cleanup();
            resolve(true);
        };

        const onNo = () => {
            cleanup();
            resolve(false);
        };

        btnYes.addEventListener("click", onYes);
        btnNo.addEventListener("click", onNo);
    });
}

// Toast Helper (copied from map.js)
function showToast(message, type = "success") {
    // Ensure container exists
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container"; // Ensure CSS class
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type} show`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Recompute Facility Stats (copied logic for profile usage)
async function recomputeFacilityStats(facId) {
    if (!facId) return;
    const q = query(collection(db, "reviews"), where("facilityId", "==", facId));
    const snap = await getDocs(q);

    let sum = 0;
    let count = 0;
    snap.forEach((d) => {
        const r = d.data();
        const rating = Number(r.rating) || 0;
        sum += rating;
        count += 1;
    });

    const avg = count > 0 ? Number((sum / count).toFixed(1)) : 0;

    await updateDoc(doc(db, "facilities", facId), {
        averageRating: avg,
        reviewCount: count,
    });
}

// Delete review function
// Delete review function
window.deleteReview = async (reviewId, facilityId) => {
    const confirmed = await showConfirmationModal("Sigur vrei să ștergi acest review?");
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "reviews", reviewId));
        await recomputeFacilityStats(facilityId);

        // Reload reviews
        const user = auth.currentUser;
        if (user) loadMyReviews(user.uid);

        showToast("Review șters!", "success");
    } catch (error) {
        console.error("Error deleting review:", error);
        showToast("Eroare la ștergere.", "error");
    }
};

// Remove favorite function
window.removeFavorite = async (facilityId) => {
    const confirmed = await showConfirmationModal("Sigur vrei să elimini de la favorite?");
    if (!confirmed) return;

    try {
        const user = auth.currentUser;
        if (!user) return;

        await updateDoc(doc(db, "users", user.uid), {
            favorites: arrayRemove(facilityId)
        });

        // Reload favorites
        loadMyFavorites(user.uid);

        showToast("Eliminat de la favorite!", "success");
    } catch (error) {
        console.error("Error removing favorite:", error);
        showToast("Eroare la eliminare.", "error");
    }
};


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
                        <span class="rating">⭐ ${review.rating}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <small style="color:#999">${dateStr}</small>
                        <button onclick="deleteReview('${review.id}', '${review.facilityId}')" class="btn-delete-small">Șterge</button>
                    </div>
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

// Load user's favorites
async function loadMyFavorites(userId) {
    try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        myFavoritesList.innerHTML = '';

        if (!userDocSnap.exists()) {
            myFavoritesList.innerHTML = '<p class="error-message">Nu s-a găsit profilul utilizatorului.</p>';
            return;
        }

        const userData = userDocSnap.data();
        const favoriteIds = userData.favorites || [];

        if (favoriteIds.length === 0) {
            myFavoritesList.innerHTML = '<p class="no-reviews">Nu ai nicio facilitate la favorite.</p>';
            return;
        }

        // Fetch details for each favorite facility
        const favoriteFacilities = await Promise.all(
            favoriteIds.map(async (facId) => {
                try {
                    const facRef = doc(db, "facilities", facId);
                    const facSnap = await getDoc(facRef);
                    if (facSnap.exists()) {
                        return { id: facSnap.id, ...facSnap.data() };
                    }
                } catch (err) {
                    console.error("Error fetching fav facility:", facId, err);
                }
                return null;
            })
        );

        // Filter out nulls (deleted facilities)
        const validFavorites = favoriteFacilities.filter(f => f !== null);

        if (validFavorites.length === 0) {
            myFavoritesList.innerHTML = '<p class="no-reviews">Facilitățile favorite nu mai există.</p>';
            return;
        }

        // Render favorites
        validFavorites.forEach(fac => {
            const favEl = document.createElement('div');
            favEl.className = 'review-card profile-review-card'; // Reuse same styling as reviews styling

            favEl.innerHTML = `
                <div class="review-header">
                    <div>
                        <strong><a href="details.html?id=${fac.id}" class="facility-link">${fac.name}</a></strong>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="rating">⭐ ${fac.averageRating || 0}</span>
                            <button onclick="removeFavorite('${fac.id}')" class="btn-delete-small">Șterge</button>
                        </div>
                    </div>
                </div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                    <p><strong>Tip:</strong> ${fac.type || 'N/A'}</p>
                    <p><strong>Adresă:</strong> ${fac.address || 'N/A'}</p>
                </div>
            `;
            myFavoritesList.appendChild(favEl);
        });

    } catch (error) {
        console.error("Error loading favorites:", error);
        myFavoritesList.innerHTML = '<p class="error-message">Eroare la încărcarea favoritelor.</p>';
    }
}

// Check authentication and load data
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserProfile(user);
        loadMyReviews(user.uid);
        loadMyFavorites(user.uid);
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'auth.html';
    }
});


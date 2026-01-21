import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const facilityId = urlParams.get('id');

const nameEl = document.getElementById('targetFacilityName');
const formEl = document.getElementById('safeReviewForm');
const warningEl = document.getElementById('authWarning');
const submitBtn = document.getElementById('submitReviewBtn');

let currentUser = null;

// 1. Check Auth Status
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        warningEl.style.display = 'none';
        submitBtn.disabled = false;
    } else {
        currentUser = null;
        warningEl.style.display = 'block';
        submitBtn.disabled = true;
    }
});

// 2. Load Facility Name
async function init() {
    if (!facilityId) {
        nameEl.textContent = "Eroare: Lipsă ID Locație";
        return;
    }

    try {
        const docRef = doc(db, "facilities", facilityId);
        const snp = await getDoc(docRef);
        if (snp.exists()) {
            nameEl.textContent = snp.data().name;
        } else {
            nameEl.textContent = "Locație necunoscută";
        }
    } catch (e) {
        console.error(e);
        nameEl.textContent = "Eroare încărcare date.";
    }
}

// 3. Handle Submit
formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        showToast("Autentifică-te întâi!", success=false);
        return;
    }

    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value;

    submitBtn.textContent = "Se trimite...";
    submitBtn.disabled = true;

    try {
        // Add Review
        await addDoc(collection(db, "reviews"), {
            facilityId: facilityId,
            userId: currentUser.uid,
            userName: currentUser.displayName || "Utilizator",
            rating: rating,
            comment: comment,
            createdAt: new Date()
        });

        // Update Stats
        const facRef = doc(db, "facilities", facilityId);
        const fSnap = await getDoc(facRef);

        if (fSnap.exists()) {
            const d = fSnap.data();
            const currentAvg = d.averageRating || 0;
            const currentCount = d.reviewCount || 0;

            const newCount = currentCount + 1;
            const newAvg = ((currentAvg * currentCount) + rating) / newCount;

            await updateDoc(facRef, {
                averageRating: parseFloat(newAvg.toFixed(1)),
                reviewCount: newCount
            });
        }

        showToast("Recenzia a fost trimisă!", success=true);
        // Redirect back to details
        window.location.href = `details.html?id=${facilityId}`;

    } catch (err) {
        console.error(err);
        showToast("A apărut o eroare: " + err.message, success=false);
        submitBtn.textContent = "Publică Recenzia";
        submitBtn.disabled = false;
    }
});

init();

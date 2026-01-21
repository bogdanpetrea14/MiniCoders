import { db, auth } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const facilityId = urlParams.get("id");

const facilityName = document.getElementById("facilityName");
const facilityType = document.getElementById("facilityType");
const facilityAddress = document.getElementById("facilityAddress");
const facilityHours = document.getElementById("facilityHours");
const facilityRating = document.getElementById("facilityRating");
const facilityDescription = document.getElementById("facilityDescription");

const reviewsList = document.getElementById("reviewsList");
const reviewForm = document.getElementById("reviewForm");
const addReviewContainer = document.getElementById("addReviewContainer");

let isAdmin = false;

// ---------- Helpers ----------
function formatDate(createdAt) {
  if (!createdAt) return "";
  // Firestore Timestamp
  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString("ro-RO");
  }
  // JS Date
  if (createdAt instanceof Date) {
    return createdAt.toLocaleDateString("ro-RO");
  }
  // Timestamp has toDate()
  if (typeof createdAt.toDate === "function") {
    return createdAt.toDate().toLocaleDateString("ro-RO");
  }
  return "";
}

async function recomputeFacilityStats() {
  // Re-calc based on ALL reviews for the facility (robust)
  const q = query(collection(db, "reviews"), where("facilityId", "==", facilityId));
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

  await updateDoc(doc(db, "facilities", facilityId), {
    averageRating: avg,
    reviewCount: count,
  });
}

async function deleteReviewById(reviewId, reviewUserName = "review") {
  if (!isAdmin) {
    alert("Nu ai permisiunea de admin pentru ștergere.");
    return;
  }
  if (!confirm(`Sigur vrei să ștergi acest review (${reviewUserName})?`)) return;

  try {
    await deleteDoc(doc(db, "reviews", reviewId));
    await recomputeFacilityStats();
    await loadReviews();
    await loadFacilityDetails();
  } catch (err) {
    console.error("Delete review failed:", err);
    alert(`Eroare la ștergere: ${err.code || err.message}`);
  }
}

// ---------- Load Facility Details ----------
async function loadFacilityDetails() {
  if (!facilityId) return;

  try {
    const docRef = doc(db, "facilities", facilityId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      facilityName.textContent = data.name ?? "";
      facilityType.textContent = (data.type ?? "") + (data.priceLevel ? ` (${data.priceLevel})` : "");
      facilityAddress.textContent = data.address ?? "";
      facilityHours.textContent = data.openedHours || "08:00 - 22:00";
      facilityRating.textContent = `★ ${data.averageRating ?? "N/A"}`;
      facilityDescription.textContent = data.description || "Fără descriere.";
    } else {
      document.querySelector(".details-container").innerHTML = "<h2>Facilitatea nu a fost găsită!</h2>";
    }
  } catch (error) {
    console.error("Error getting facility document:", error);
  }
}

// ---------- Load Reviews ----------
async function loadReviews() {
  if (!facilityId) return;

  const q = query(collection(db, "reviews"), where("facilityId", "==", facilityId));
  const querySnapshot = await getDocs(q);

  reviewsList.innerHTML = "";

  if (querySnapshot.empty) {
    reviewsList.innerHTML = "<p>Nu există recenzii încă.</p>";
    return;
  }

  querySnapshot.forEach((reviewDoc) => {
    const review = reviewDoc.data();
    const reviewId = reviewDoc.id;

    const reviewEl = document.createElement("div");
    reviewEl.className = "review-card";

    const dateStr = formatDate(review.createdAt);

    // Header
    const header = document.createElement("div");
    header.className = "review-header";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.gap = "10px";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${review.userName || "Utilizator"}</strong>`;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const ratingSpan = document.createElement("span");
    ratingSpan.className = "rating";
    ratingSpan.textContent = `★ ${review.rating}`;

    right.appendChild(ratingSpan);

    // Admin delete button
    if (isAdmin) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Șterge";
      delBtn.className = "btn";
      delBtn.style.background = "#e74c3c";
      delBtn.style.padding = "6px 10px";
      delBtn.style.borderRadius = "6px";
      delBtn.style.fontSize = "0.85rem";
      delBtn.style.whiteSpace = "nowrap";

      delBtn.addEventListener("click", () => {
        deleteReviewById(reviewId, review.userName || "Utilizator");
      });

      right.appendChild(delBtn);
    }

    header.appendChild(left);
    header.appendChild(right);

    // Body
    const commentP = document.createElement("p");
    commentP.textContent = review.comment || "";

    const small = document.createElement("small");
    small.style.color = "#999";
    small.textContent = dateStr;

    reviewEl.appendChild(header);
    reviewEl.appendChild(commentP);
    reviewEl.appendChild(small);

    reviewsList.appendChild(reviewEl);
  });
}

// ---------- Add Review ----------
if (reviewForm) {
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rating = parseInt(document.getElementById("rating").value, 10);
    const comment = document.getElementById("comment").value;
    const user = auth.currentUser;

    if (!user) {
      alert("Trebuie să fii autentificat!");
      return;
    }

    try {
      // 1) Add review
      await addDoc(collection(db, "reviews"), {
        facilityId,
        userId: user.uid,
        userName: user.displayName || "Anonim",
        rating,
        comment,
        createdAt: new Date(),
      });

      // 2) Recompute stats (robust)
      await recomputeFacilityStats();

      alert("Recenzie adăugată!");
      reviewForm.reset();

      await loadReviews();
      await loadFacilityDetails();
    } catch (error) {
      console.error("Error adding review:", error);
      alert("Eroare la adăugarea recenziei.");
    }
  });
}

// ---------- Auth / Role ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    addReviewContainer.style.display = "block";

    // determine role from users collection (same logic as auth.js)
    try {
      const uSnap = await getDoc(doc(db, "users", user.uid));
      isAdmin = uSnap.exists() && uSnap.data().role === "admin";
    } catch (e) {
      console.error("Role check failed:", e);
      isAdmin = false;
    }

    // re-render reviews so admin buttons appear
    await loadReviews();
  } else {
    addReviewContainer.style.display = "none";
    isAdmin = false;
    await loadReviews(); // render without delete buttons
  }
});

// ---------- Init ----------
if (facilityId) {
  loadFacilityDetails();
  loadReviews();
}

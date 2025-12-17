
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCf5kvAeUhUqFpIvxSFHvpYfjiFRnhHKqI",
  authDomain: "minicoders-67a4a.firebaseapp.com",
  projectId: "minicoders-67a4a",
  storageBucket: "minicoders-67a4a.appspot.com",
  messagingSenderId: "137862444944",
  appId: "1:137862444944:web:02a2b30631a7abbc6b6515",
  measurementId: "G-LY4Q2KGD7V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };


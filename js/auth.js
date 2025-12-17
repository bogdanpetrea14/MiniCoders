import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const authForm = document.getElementById('authForm');
const switchLink = document.getElementById('switchLink');
const authTitle = document.getElementById('authTitle');
const submitBtn = document.getElementById('submitBtn');
const nameGroup = document.getElementById('nameGroup');
const switchText = document.getElementById('switchText');
const authMessage = document.getElementById('authMessage');

let isLogin = true;

// Handle Auth State on Page Load (for Navbar)
onAuthStateChanged(auth, (user) => {
    const authLink = document.getElementById('authLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileBtn = document.getElementById('profileBtn');

    if (user) {
        console.log("User is logged in:", user.email);
        if (authLink) authLink.style.display = 'none';
        if (profileBtn) {
            profileBtn.style.display = 'inline-block';
            profileBtn.style.visibility = 'visible';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-block';
            logoutBtn.style.visibility = 'visible';
            // Remove existing listeners to avoid duplicates
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            newLogoutBtn.addEventListener('click', () => {
                signOut(auth).then(() => {
                    window.location.href = 'index.html';
                });
            });
        }
    } else {
        console.log("User is logged out");
        if (authLink) authLink.style.display = 'inline-block';
        if (profileBtn) {
            profileBtn.style.display = 'none';
            profileBtn.style.visibility = 'hidden';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
            logoutBtn.style.visibility = 'hidden';
        }
    }
});

// Auth Page Logic
if (authForm) {
    switchLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        if (isLogin) {
            authTitle.textContent = 'Autentificare';
            submitBtn.textContent = 'Logare';
            nameGroup.style.display = 'none';
            switchText.innerHTML = 'Nu ai cont? <a href="#" id="switchLink">Înregistrează-te</a>';
        } else {
            authTitle.textContent = 'Înregistrare';
            submitBtn.textContent = 'Creează cont';
            nameGroup.style.display = 'block';
            switchText.innerHTML = 'Ai deja cont? <a href="#" id="switchLink">Loghează-te</a>';
        }
        // Re-attach listener because innerHTML replaced the element
        document.getElementById('switchLink').addEventListener('click', arguments.callee);
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = 'index.html';
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Update profile
                await updateProfile(user, { displayName: name });

                // Create user document in Firestore
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    email: email,
                    displayName: name,
                    role: "user",
                    createdAt: new Date()
                });

                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error(error);
            authMessage.textContent = error.message;
        }
    });
}

import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Paste the JSON array from Step 1 here
const facilitiesData = [
  {
    "name": "Arena Națională",
    "type": "fotbal",
    "address": "Bulevardul Basarabia 37-39, București",
    "description": "Cel mai mare stadion din țară.",
    "phone": "021 123 4567",
    "priceLevel": "Ridicat",
    "latitude": 44.4370,
    "longitude": 26.1525,
    "averageRating": 4.8,
    "reviewCount": 0
  },
  {
    "name": "World Class Bucharest Atlantis",
    "type": "fitness",
    "address": "Strada Erou Iancu Nicolae 12-26, Voluntari",
    "description": "Sală de fitness premium cu piscină.",
    "phone": "031 405 0800",
    "priceLevel": "Ridicat",
    "latitude": 44.5085,
    "longitude": 26.1158,
    "averageRating": 4.5,
    "reviewCount": 0
  },
  {
    "name": "Parcul Sportiv Dinamo",
    "type": "complex",
    "address": "Șoseaua Ștefan cel Mare 7-9, București",
    "description": "Complex sportiv istoric cu stadion, bazin și săli.",
    "phone": "021 210 6666",
    "priceLevel": "Mediu",
    "latitude": 44.4535,
    "longitude": 26.1030,
    "averageRating": 4.2,
    "reviewCount": 0
  },
  {
    "name": "Tenis Club Herăstrău",
    "type": "tenis",
    "address": "Șoseaua Nordului 7-9, București",
    "description": "Terenuri de tenis pe zgură în parcul Herăstrău.",
    "phone": "0722 123 123",
    "priceLevel": "Mediu",
    "latitude": 44.4755,
    "longitude": 26.0885,
    "averageRating": 4.6,
    "reviewCount": 0
  },
  {
    "name": "Bazinul Olimpic Lia Manoliu",
    "type": "inot",
    "address": "Bulevardul Basarabia 37, București",
    "description": "Bazin olimpic acoperit și descoperit.",
    "phone": "021 324 5555",
    "priceLevel": "Scăzut",
    "latitude": 44.4395,
    "longitude": 26.1490,
    "averageRating": 4.3,
    "reviewCount": 0
  },
  {
    "name": "Pista de Atletism Iolanda Balaș",
    "type": "alergare",
    "address": "Bulevardul Mărăști 20, București",
    "description": "Pistă profesională de atletism.",
    "phone": "N/A",
    "priceLevel": "Scăzut",
    "latitude": 44.4670,
    "longitude": 26.0750,
    "averageRating": 4.7,
    "reviewCount": 0
  }
];

async function seedDatabase() {
    const colRef = collection(db, "facilities");
    
    for (const facility of facilitiesData) {
        try {
            // 1. Add document to get an auto-generated ID
            const docRef = await addDoc(colRef, {
                ...facility,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: "system_admin",
                openedHours: "08:00 - 22:00" // Default hours
            });

            // 2. Update the document to include its own ID (as per your schema screenshot 'facilityId')
            await updateDoc(docRef, {
                facilityId: docRef.id
            });

            console.log(`Added facility: ${facility.name}`);
        } catch (e) {
            console.error("Error adding document: ", e);
        }
    }
    alert("Database seeded successfully!");
}

// Uncomment to run
// seedDatabase();
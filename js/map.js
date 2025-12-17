import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your ArcGIS API Key
const apiKey = "AAPTxy8BH1VEsoebNVZXo8HurJkT0tmZGqmeZW-Op790dOuenTFyF5piiH3bGkds8hStWnKcEwlxt50gYSDGEJhcI23gCFOX-i5YTnPq153nGWwv6weqvxJ1HA1aT0SD7OdBWT8peIW93HKi8CLCyQVdSXOtsgN6_86NsiwliaDmyAiMVEishmcJBqab-u0ELfCb7YQT-aWpMmArcPrytePscNfxQI7CdC1dqij5g8cfYoM.AT1_VbTxb1t6";

require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Search",
    "esri/widgets/Locate"
], function (esriConfig, Map, MapView, Graphic, GraphicsLayer, Search, Locate) {

    esriConfig.apiKey = apiKey;

    const map = new Map({
        basemap: "arcgis/topographic"
    });

    const view = new MapView({
        map: map,
        center: [26.1025, 44.4268], // Bucharest
        zoom: 12,
        container: "viewDiv"
    });

    // Create a layer to hold our custom points
    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    // Define the popup that appears when you click a dot
    const popupTemplate = {
        title: "{name}",
        content: `
            <p><b>Tip:</b> {type}</p>
            <p><b>Adresă:</b> {address}</p>
            <p><b>Rating:</b> ⭐ {averageRating}</p>
            <a href='details.html?id={facilityId}' class='btn' style='display:block; margin-top:10px; text-align:center; background:#3498db; color:white; padding:8px; text-decoration:none; border-radius:4px;'>Vezi Detalii & Recenzii</a>
        `
    };

    // --- MAIN FUNCTION: Fetch from Firestore & Add to Map ---
    async function loadFacilitiesPoints() {
        const facilityListSidebar = document.getElementById("facilityList");
        facilityListSidebar.innerHTML = "<p>Se încarcă...</p>"; 

        try {
            // 1. Get data from Firestore
            const querySnapshot = await getDocs(collection(db, "facilities"));
            
            facilityListSidebar.innerHTML = ""; // Clear "Loading..." text

            querySnapshot.forEach((doc) => {
                const data = doc.data();

                // 2. Only map items that have coordinates
                if (data.latitude && data.longitude) {
                    
                    // Create the point geometry
                    const point = {
                        type: "point",
                        longitude: data.longitude,
                        latitude: data.latitude
                    };

                    // Create the symbol (Orange dot)
                    const simpleMarkerSymbol = {
                        type: "simple-marker",
                        color: [226, 119, 40],  // Orange color
                        outline: {
                            color: [255, 255, 255], // White border
                            width: 1
                        }
                    };

                    // Combine them into a Graphic
                    const pointGraphic = new Graphic({
                        geometry: point,
                        symbol: simpleMarkerSymbol,
                        attributes: data, // Attach all data to the graphic so popup works
                        popupTemplate: popupTemplate
                    });

                    // Add to map
                    graphicsLayer.add(pointGraphic);

                    // 3. Add to Sidebar List
                    const listItem = document.createElement("div");
                    listItem.className = "facility-item";
                    listItem.innerHTML = `
                        <h4>${data.name}</h4>
                        <p>${data.type} • ⭐ ${data.averageRating || 0}</p>
                    `;
                    
                    // Click sidebar item to zoom to point
                    listItem.addEventListener("click", () => {
                        view.goTo({
                            target: pointGraphic,
                            zoom: 15
                        });
                        view.openPopup({
                            features: [pointGraphic],
                            location: pointGraphic.geometry
                        });
                    });

                    facilityListSidebar.appendChild(listItem);
                }
            });

        } catch (error) {
            console.error("Error loading facilities:", error);
            facilityListSidebar.innerHTML = "<p>Eroare la încărcarea datelor.</p>";
        }
    }

    // Run the function!
    loadFacilitiesPoints();

    // Add Search and Locate widgets
    const search = new Search({ view: view });
    view.ui.add(search, "top-right");

    const locate = new Locate({ view: view });
    view.ui.add(locate, "top-left");

    // Filter Logic
    const typeFilter = document.getElementById("typeFilter");
    if (typeFilter) {
        typeFilter.addEventListener("change", (event) => {
            const selectedType = event.target.value;
            
            // Loop through all graphics and hide/show them
            graphicsLayer.graphics.forEach((graphic) => {
                if (selectedType === "all" || graphic.attributes.type === selectedType) {
                    graphic.visible = true;
                } else {
                    graphic.visible = false;
                }
            });
        });
    }
});
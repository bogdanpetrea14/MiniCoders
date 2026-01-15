import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your ArcGIS API Key
const apiKey = "AAPTxy8BH1VEsoebNVZXo8HurJkT0tmZGqmeZW-Op790dOuenTFyF5piiH3bGkds8hStWnKcEwlxt50gYSDGEJhcI23gCFOX-i5YTnPq153nGWwv6weqvxJ1HA1aT0SD7OdBWT8peIW93HKi8CLCyQVdSXOtsgN6_86NsiwliaDmyAiMVEishmcJBqab-u0ELfCb7YQT-aWpMmArcPrytePscNfxQI7CdC1dqij5g8cfYoM.AT1_VbTxb1t6";

console.log("map.js: Loading ArcGIS modules via window.require...");

// Ensure DOM is ready before we start loading ArcGIS
document.addEventListener("DOMContentLoaded", () => {
    console.log("map.js: DOM Content Loaded.");
});

window.require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Search",
    "esri/widgets/Locate",
    "esri/rest/locator",
    "esri/rest/route",
    "esri/rest/support/RouteParameters",
    "esri/rest/support/FeatureSet",
    "esri/geometry/Point",
    "esri/geometry/Polyline",
    "esri/geometry/support/webMercatorUtils"
], function (esriConfig, Map, MapView, Graphic, GraphicsLayer, Search, Locate, locator, route, RouteParameters, FeatureSet, Point, Polyline, webMercatorUtils) {
    console.log("ArcGIS modules loaded"); // DEBUG
    console.log("map.js: ArcGIS modules received.");
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

    // Layers for route drawing and start marker
    const routeLayer = new GraphicsLayer();
    const startLayer = new GraphicsLayer();
    map.add(routeLayer);
    map.add(startLayer);

    const routeServiceUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";
    let selectedFacilityGraphic = null;
    let startPointGeo = null;
    let endPointGeo = null;

    // Define the popup that appears when you click a dot
    const popupTemplate = {
        title: "{name}",
        content: `
            <p><b>Tip:</b> {type}</p>
            <p><b>Adresă:</b> {address}</p>
            <p><b>Rating:</b> ⭐ {averageRating}</p>
            <a href='details.html?id={facilityId}' class='btn' style='display:block; margin-top:10px; text-align:center; background:#3498db; color:white; padding:8px; text-decoration:none; border-radius:4px;'>Vezi Detalii & Recenzii</a>
        `,
        actions: [{
            title: "Şterge",
            id: "delete-facility-action",
            className: "esri-icon-trash delete-action-btn"
        }]
    };

    // --- MAIN FUNCTION: Fetch from Firestore & Add to Map ---
    async function loadFacilitiesPoints() {
        console.log("map.js: loadFacilitiesPoints starting...");
        const facilityListSidebar = document.getElementById("facilityList");
        if (!facilityListSidebar) {
            console.error("map.js: facilityList element not found!");
            return;
        }

        facilityListSidebar.innerHTML = "<p>Se încarcă facilitățile...</p>";

        try {
            const querySnapshot = await getDocs(collection(db, "facilities"));
            console.log("map.js: Firestore returned", querySnapshot.size, "documents.");
            facilityListSidebar.innerHTML = "";

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const docId = docSnap.id;

                if (data.latitude && data.longitude) {
                    const point = {
                        type: "point",
                        longitude: data.longitude,
                        latitude: data.latitude
                    };

                    const pointGraphic = new Graphic({
                        geometry: point,
                        symbol: {
                            type: "simple-marker",
                            color: [226, 119, 40],
                            outline: {
                                color: [255, 255, 255],
                                width: 1
                            }
                        },
                        attributes: {
                            ...data,
                            facilityId: docId
                        },
                        popupTemplate: popupTemplate
                    });

                    graphicsLayer.add(pointGraphic);

                    // Add to Sidebar List
                    const listItem = document.createElement("div");
                    listItem.className = "facility-item";
                    listItem.dataset.type = data.type;
                    listItem.innerHTML = `
                        <h4>${data.name}</h4>
                        <p>${data.type} • ⭐ ${data.averageRating || 0}</p>
                    `;

                    listItem.addEventListener("click", () => {
                        selectedFacilityGraphic = pointGraphic;
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
            console.log("map.js: Finished adding graphics and sidebar items.");

        } catch (error) {
            console.error("map.js: Error in loadFacilitiesPoints:", error);
            facilityListSidebar.innerHTML = "<p>Eroare la încărcarea datelor.</p>";
        }
    }

    // Run the function!
    loadFacilitiesPoints();

    // Handle Deletion Logic - Robust selection matches both ID and Title
    view.popup.on("trigger-action", async (event) => {
        console.log("map.js: Popup action clicked!", event.action.id, event.action.title);

        if (event.action.id === "delete-facility-action" || event.action.title === "Şterge") {
            const isAdmin = document.body.classList.contains("is-admin");
            console.log("map.js: Admin check for delete:", isAdmin);

            if (!isAdmin) {
                showToast("Nu ai permisiunea de a şterge facilități.", "error");
                return;
            }

            const selectedFeature = view.popup.selectedFeature;
            if (!selectedFeature) {
                console.warn("map.js: No feature selected for deletion.");
                return;
            }

            const facId = selectedFeature.attributes.facilityId;
            const facName = selectedFeature.attributes.name;
            console.log("map.js: Attempting delete for:", facName, facId);

            if (confirm(`Sigur doreşti să ştergi "${facName}"?`)) {
                try {
                    await deleteDoc(doc(db, "facilities", facId));
                    console.log("map.js: Firestore delete successful.");
                    showToast(`Facilitatea "${facName}" a fost ştearsă.`, "success");

                    view.closePopup();
                    graphicsLayer.removeAll();
                    loadFacilitiesPoints();
                } catch (error) {
                    console.error("map.js: Error deleting facility:", error);
                    showToast("Eroare la ştergerea facilității.", "error");
                }
            }
        }
    });

    // Add Search and Locate widgets
    const search = new Search({ view: view });
    view.ui.add(search, "top-right");

    // Track the currently selected facility from the popup
    view.watch("popup.selectedFeature", (feature) => {
        selectedFacilityGraphic = feature || null;
    });

    function setStartMarker(mapPoint) {
        startLayer.removeAll();
        const startGraphic = new Graphic({
            geometry: mapPoint,
            symbol: {
                type: "simple-marker",
                color: [46, 204, 113],
                size: 8,
                outline: {
                    color: [255, 255, 255],
                    width: 1
                }
            }
        });
        startLayer.add(startGraphic);
    }

    function setEndMarker(mapPoint) {
        const endGraphic = new Graphic({
            geometry: mapPoint,
            symbol: {
                type: "simple-marker",
                color: [231, 76, 60],
                size: 8,
                outline: {
                    color: [255, 255, 255],
                    width: 1
                }
            }
        });
        startLayer.add(endGraphic);
    }

    function getLngLat(point) {
        const lon = point.longitude ?? point.x;
        const lat = point.latitude ?? point.y;
        return { lon, lat };
    }

    async function drawRouteBetweenPoints(startPoint, endPoint, triggerButton) {
        if (!startPoint || !endPoint) {
            return;
        }

        routeLayer.removeAll();

        try {
            if (triggerButton) {
                triggerButton.disabled = true;
                triggerButton.title = "Se calculează ruta...";
            }

            const routeParams = new RouteParameters({
                stops: new FeatureSet({
                    features: [
                        new Graphic({ geometry: startPoint }),
                        new Graphic({ geometry: endPoint })
                    ]
                }),
                returnDirections: false,
                outSpatialReference: view.spatialReference
            });

            let routeGraphic = null;

            try {
                const routeResult = await route.solve(routeServiceUrl, routeParams);
                routeGraphic = routeResult.routeResults[0]?.route || null;
            } catch (err) {
                console.warn("ArcGIS route failed, trying OSRM fallback.", err);
            }

            if (!routeGraphic) {
                const start = getLngLat(startPoint);
                const end = getLngLat(endPoint);
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
                const response = await fetch(osrmUrl);
                if (!response.ok) {
                    throw new Error("Routing service unavailable");
                }
                const data = await response.json();
                const coords = data?.routes?.[0]?.geometry?.coordinates;
                if (!coords || coords.length === 0) {
                    throw new Error("No route found");
                }

                const polyline = new Polyline({
                    paths: [coords],
                    spatialReference: { wkid: 4326 }
                });

                const projectedPolyline = view.spatialReference.isWebMercator
                    ? webMercatorUtils.geographicToWebMercator(polyline)
                    : polyline;

                routeGraphic = new Graphic({
                    geometry: projectedPolyline,
                    symbol: {
                        type: "simple-line",
                        color: [52, 152, 219, 0.85],
                        width: 4
                    }
                });
            } else {
                routeGraphic.symbol = {
                    type: "simple-line",
                    color: [52, 152, 219, 0.85],
                    width: 4
                };
            }

            routeLayer.add(routeGraphic);
            view.goTo(routeGraphic);
        } catch (error) {
            console.error("Route error:", error);
            const message = error?.message ? ` (${error.message})` : "";
            alert(`Nu s-a putut calcula ruta. Verifică permisiunea de locație.${message}`);
        } finally {
            if (triggerButton) {
                triggerButton.disabled = false;
                triggerButton.title = "Generează traseu";
            }
        }
    }

    view.on("click", (event) => {
        const mapPoint = event.mapPoint;
        if (!mapPoint) return;

        const geoPoint = view.spatialReference.isWebMercator
            ? webMercatorUtils.webMercatorToGeographic(mapPoint)
            : mapPoint;
        const { lon, lat } = getLngLat(geoPoint);
        const clickedPoint = new Point({
            longitude: lon,
            latitude: lat,
            spatialReference: { wkid: 4326 }
        });

        if (!startPointGeo) {
            startPointGeo = clickedPoint;
            endPointGeo = null;
            startLayer.removeAll();
            setStartMarker(mapPoint);
            routeLayer.removeAll();
            return;
        }

        endPointGeo = clickedPoint;
        setEndMarker(mapPoint);
        drawRouteBetweenPoints(startPointGeo, endPointGeo);

        // Reset for next route selection
        startPointGeo = null;
        endPointGeo = null;
    });

    // Filter Logic
    const typeFilter = document.getElementById("typeFilter");
    if (typeFilter) {
        typeFilter.addEventListener("change", (event) => {
            const selectedType = event.target.value;
            graphicsLayer.graphics.forEach((graphic) => {
                if (selectedType === "all" || graphic.attributes.type === selectedType) {
                    graphic.visible = true;
                } else {
                    graphic.visible = false;
                }
            });

            // Filter Sidebar List
            const facilityItems = document.querySelectorAll(".facility-item");
            facilityItems.forEach((item) => {
                if (selectedType === "all" || item.dataset.type === selectedType) {
                    item.style.display = "block";
                } else {
                    item.style.display = "none";
                }
            });
        });
    }

    // --- ADMIN: Add Facility Logic ---
    let isAddMode = false;
    const addFacilityBtn = document.getElementById("addFacilityBtn");
    const modal = document.getElementById("addFacilityModal");
    const closeBtn = document.querySelector(".close");
    const addFacilityForm = document.getElementById("addFacilityForm");
    const appContainer = document.querySelector(".container");

    const locatorUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

    if (addFacilityBtn) {
        addFacilityBtn.addEventListener("click", () => {
            isAddMode = !isAddMode;
            if (isAddMode) {
                addFacilityBtn.classList.add("active-mode");
                addFacilityBtn.textContent = "Click pe hartă (Anulează)";
                appContainer.classList.add("add-mode-cursor");
            } else {
                addFacilityBtn.classList.remove("active-mode");
                addFacilityBtn.textContent = "Adaugă facilitate";
                appContainer.classList.remove("add-mode-cursor");
            }
        });
    }

    view.on("click", (event) => {
        if (!isAddMode) return;

        console.log("map.js: Map clicked in add mode.");
        document.getElementById("facLat").value = event.mapPoint.latitude;
        document.getElementById("facLng").value = event.mapPoint.longitude;

        locator.locationToAddress(locatorUrl, { location: event.mapPoint })
            .then((response) => {
                let cleanAddress = "";
                if (response.attributes && response.attributes.Address) {
                    cleanAddress = response.attributes.Address;
                    if (response.attributes.City) cleanAddress += ", " + response.attributes.City;
                } else {
                    cleanAddress = response.address;
                }
                document.getElementById("facAddress").value = cleanAddress;
                modal.style.display = "block";
            })
            .catch((err) => {
                console.error("map.js: Geocoding error:", err);
                document.getElementById("facAddress").value = "";
                modal.style.display = "block";
            });

        isAddMode = false;
        addFacilityBtn.classList.remove("active-mode");
        addFacilityBtn.textContent = "Adaugă facilitate";
        appContainer.classList.remove("add-mode-cursor");
    });

    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = "none";
    }
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    };

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type} show`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    if (addFacilityForm) {
        addFacilityForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newFacility = {
                name: document.getElementById("facName").value,
                type: document.getElementById("facType").value,
                address: document.getElementById("facAddress").value,
                openedHours: document.getElementById("facOpenedHours").value,
                phone: document.getElementById("facPhone").value,
                priceLevel: document.getElementById("facPrice").value,
                description: document.getElementById("facDescription").value,
                latitude: parseFloat(document.getElementById("facLat").value),
                longitude: parseFloat(document.getElementById("facLng").value),
                averageRating: 0,
                reviewCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: "admin"
            };

            try {
                await addDoc(collection(db, "facilities"), newFacility);
                modal.style.display = "none";
                addFacilityForm.reset();
                showToast("Facilitatea a fost adăugată cu succes!", "success");
                graphicsLayer.removeAll();
                loadFacilitiesPoints();
            } catch (error) {
                console.error("map.js: Error adding facility:", error);
                showToast("Eroare la salvarea facilității.", "error");
            }
        });
    }

    console.log("map.js: Initialization complete.");
});
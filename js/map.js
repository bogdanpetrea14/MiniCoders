import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your ArcGIS API Key
const apiKey = "AAPTxy8BH1VEsoebNVZXo8HurJkT0tmZGqmeZW-Op790dOuenTFyF5piiH3bGkds8hStWnKcEwlxt50gYSDGEJhcI23gCFOX-i5YTnPq153nGWwv6weqvxJ1HA1aT0SD7OdBWT8peIW93HKi8CLCyQVdSXOtsgN6_86NsiwliaDmyAiMVEishmcJBqab-u0ELfCb7YQT-aWpMmArcPrytePscNfxQI7CdC1dqij5g8cfYoM.AT1_VbTxb1t6";

// Load ArcGIS after Firebase is ready
require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Search",
    "esri/rest/route",
    "esri/rest/support/RouteParameters",
    "esri/rest/support/FeatureSet",
    "esri/geometry/Point",
    "esri/geometry/Polyline",
    "esri/geometry/support/webMercatorUtils"
], function (esriConfig, Map, MapView, Graphic, GraphicsLayer, Search, route, RouteParameters, FeatureSet, Point, Polyline, webMercatorUtils) {
    console.log("ArcGIS modules loaded"); // DEBUG

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
        `
    };

    // --- MAIN FUNCTION: Fetch from Firestore & Add to Map ---
    async function loadFacilitiesPoints() {
        const facilityListSidebar = document.getElementById("facilityList");
        if (!facilityListSidebar) return;
        
        facilityListSidebar.innerHTML = "<p>Se încarcă...</p>"; 

        try {
            // 1. Get data from Firestore
            const querySnapshot = await getDocs(collection(db, "facilities"));
            console.log("Facilities loaded:", querySnapshot.size); // DEBUG
            
            facilityListSidebar.innerHTML = ""; // Clear "Loading..." text

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const docId = doc.id;
                console.log("Facility:", data); // DEBUG

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
                        attributes: {
                            ...data,
                            facilityId: docId  // Make sure facilityId is in attributes
                        },
                        popupTemplate: popupTemplate
                    });

                    // Add to map
                    graphicsLayer.add(pointGraphic);

                    // 3. Add to Sidebar List
                    const listItem = document.createElement("div");
                    listItem.className = "facility-item";
                    listItem.dataset.type = data.type;
                    listItem.innerHTML = `
                        <h4>${data.name}</h4>
                        <p>${data.type} • ⭐ ${data.averageRating || 0}</p>
                    `;
                    
                    // Click sidebar item to zoom to point
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

        } catch (error) {
            console.error("Error loading facilities:", error);
            if (facilityListSidebar) {
                facilityListSidebar.innerHTML = "<p>Eroare la încărcarea datelor.</p>";
            }
        }
    }

    // Run the function!
    loadFacilitiesPoints();

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
            
            // Loop through all graphics and hide/show them
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
});
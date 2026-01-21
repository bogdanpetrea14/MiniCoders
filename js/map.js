import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ArcGIS API Key
const apiKey =
  "AAPTxy8BH1VEsoebNVZXo8HurJkT0tmZGqmeZW-Op790dOuenTFyF5piiH3bGkds8hStWnKcEwlxt50gYSDGEJhcI23gCFOX-i5YTnPq153nGWwv6weqvxJ1HA1aT0SD7OdBWT8peIW93HKi8CLCyQVdSXOtsgN6_86NsiwliaDmyAiMVEishmcJBqab-u0ELfCb7YQT-aWpMmArcPrytePscNfxQI7CdC1dqij5g8cfYoM.AT1_VbTxb1t6";

console.log("map.js: Loading ArcGIS modules via window.require...");

document.addEventListener("DOMContentLoaded", () => {
  console.log("map.js: DOM Content Loaded.");
});

window.require(
  [
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
    "esri/geometry/support/webMercatorUtils",
    "esri/core/reactiveUtils",
  ],
  function (
    esriConfig,
    Map,
    MapView,
    Graphic,
    GraphicsLayer,
    Search,
    Locate,
    locator,
    route,
    RouteParameters,
    FeatureSet,
    Point,
    Polyline,
    webMercatorUtils,
    reactiveUtils
  ) {
    console.log("ArcGIS modules loaded");
    console.log("map.js: ArcGIS modules received.");

    esriConfig.apiKey = apiKey;

    const map = new Map({ basemap: "arcgis/topographic" });

    const view = new MapView({
      map,
      center: [26.1025, 44.4268],
      zoom: 12,
      container: "viewDiv",
    });

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    // Routing layers
    const routeLayer = new GraphicsLayer();
    const startLayer = new GraphicsLayer();
    map.add(routeLayer);
    map.add(startLayer);

    const routeServiceUrl =
      "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

    let selectedFacilityGraphic = null;
    let startPointGeo = null;
    let endPointGeo = null;

    // Toast helper (sus, ca să fie disponibil peste tot)
    function showToast(message, type = "success") {
      const container = document.getElementById("toast-container");
      if (!container) return;
      const toast = document.createElement("div");
      toast.className = `toast ${type} show`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // PopupTemplate: content ca funcție => buton real (nu link HTML),
    // și stopPropagation ca să nu-ți declanșeze view.on("click") / routing.
    // Global variables for user state
    let currentUser = null;
    let isUserAdmin = false;

    // Popup Template Generator
    function getPopupTemplate() {
      const actions = [];

      if (isUserAdmin) {
        actions.push({
          title: "Șterge",
          id: "delete-facility-action",
          className: "esri-icon-trash",
        });
      } else if (currentUser) {
        // Logged in normal user -> Favorites
        actions.push({
          title: "Adaugă la favorite",
          id: "toggle-favorite-action",
          className: "esri-icon-custom-heart", // Custom Heart icon
        });
      }

      return {
        title: "{name}",
        content: (event) => {
          const attrs = event?.graphic?.attributes || {};
          const wrap = document.createElement("div");

          wrap.innerHTML = `
            <p><b>Tip:</b> ${attrs.type ?? ""}</p>
            <p><b>Adresă:</b> ${attrs.address ?? ""}</p>
            <p><b>Rating:</b> ⭐ ${attrs.averageRating ?? 0}</p>
          `;

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn";
          btn.textContent = "Vezi Detalii & Recenzii";
          btn.style.cssText =
            "display:block;margin-top:10px;width:100%;text-align:center;background:#3498db;color:white;padding:10px;border:0;border-radius:4px;cursor:pointer;";

          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const id = attrs.facilityId;
            if (!id) {
              showToast("Lipsește facilityId pentru detalii.", "error");
              return;
            }
            window.open(
              `details.html?id=${encodeURIComponent(id)}`,
              "_blank",
              "noopener"
            );
          });

          wrap.appendChild(btn);
          return wrap;
        },
        actions: actions,
      };
    }

    // Load facilities
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
        console.log(
          "map.js: Firestore returned",
          querySnapshot.size,
          "documents."
        );

        facilityListSidebar.innerHTML = "";
        graphicsLayer.removeAll();

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const docId = docSnap.id;

          if (!data.latitude || !data.longitude) return;

          const pointGraphic = new Graphic({
            geometry: {
              type: "point",
              longitude: data.longitude,
              latitude: data.latitude,
            },
            symbol: {
              type: "simple-marker",
              color: [226, 119, 40],
              outline: { color: [255, 255, 255], width: 1 },
            },
            attributes: { ...data, facilityId: docId },
            popupTemplate: getPopupTemplate(),
          });

          graphicsLayer.add(pointGraphic);

          const listItem = document.createElement("div");
          listItem.className = "facility-item";
          listItem.dataset.type = data.type || "";
          listItem.innerHTML = `
            <h4>${data.name ?? "Fără nume"}</h4>
            <p>${data.type ?? ""} • ⭐ ${data.averageRating || 0}</p>
          `;

          listItem.addEventListener("click", () => {
            selectedFacilityGraphic = pointGraphic;
            view.goTo({ target: pointGraphic, zoom: 15 });
            view.openPopup({
              features: [pointGraphic],
              location: pointGraphic.geometry,
            });
          });

          facilityListSidebar.appendChild(listItem);
        });

        console.log("map.js: Finished adding graphics and sidebar items.");
      } catch (error) {
        console.error("map.js: Error in loadFacilitiesPoints:", error);
        facilityListSidebar.innerHTML = "<p>Eroare la încărcarea datelor.</p>";
        showToast("Eroare la încărcarea facilităților.", "error");
      }
    }

    // Monitor Auth State
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      isUserAdmin = false;

      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().role === "admin") {
            isUserAdmin = true;
          }
        } catch (e) {
          console.error("map.js: Role check failed:", e);
        }
      }

      console.log("map.js: Auth changed. User:", user?.email, "Admin:", isUserAdmin);
      // Reload points to update PopupTemplates with correct actions
      loadFacilitiesPoints();
    });

    // ✅ DELETE handler – robust: așteaptă până există popup.viewModel și abia apoi atașează on()
    view.when(() => {
      console.log("map.js: View ready, attaching popup listener.");

      reactiveUtils
        .whenOnce(
          () =>
            !!view.popup &&
            !!view.popup.viewModel &&
            typeof view.popup.viewModel.on === "function"
        )
        .then(() => {
          console.log("map.js: Popup viewModel ready.");

          view.popup.viewModel.on("trigger-action", async (event) => {
            const actionId = event.action.id;
            const selectedFeature = view.popup.selectedFeature;

            if (!selectedFeature) {
              showToast("Nu am găsit facilitatea selectată.", "error");
              return;
            }
            const facId = selectedFeature?.attributes?.facilityId;
            const facName = selectedFeature?.attributes?.name ?? "facilitatea";

            // --- DELETE ACTION ---
            if (actionId === "delete-facility-action") {
              if (!isUserAdmin) {
                showToast("Nu ai permisiunea de a șterge facilități.", "error");
                return;
              }

              if (!facId) {
                showToast("Lipsește facilityId (nu pot șterge).", "error");
                return;
              }

              if (!confirm(`Sigur dorești să ștergi "${facName}"?`)) return;

              try {
                await deleteDoc(doc(db, "facilities", facId));
                showToast(`Facilitatea "${facName}" a fost ștearsă.`, "success");
                view.closePopup();
                loadFacilitiesPoints();
              } catch (error) {
                console.error("Delete failed:", error);
                showToast(`Eroare la ștergere: ${error.message}`, "error");
              }
            }

            // --- FAVORITE ACTION ---
            if (actionId === "toggle-favorite-action") {
              if (!currentUser) {
                showToast("Trebuie să fii autentificat.", "error");
                return;
              }
              if (!facId) {
                showToast("Lipsește facilityId.", "error");
                return;
              }

              try {
                // Check if already favorite
                const userRef = doc(db, "users", currentUser.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                const favs = userData.favorites || [];

                const isFav = favs.includes(facId);

                if (isFav) {
                  // Remove
                  await updateDoc(userRef, {
                    favorites: arrayRemove(facId)
                  });
                  showToast("Eliminat de la favorite.", "success");
                } else {
                  // Add
                  await updateDoc(userRef, {
                    favorites: arrayUnion(facId)
                  });
                  showToast("Adăugat la favorite! ❤️", "success");
                }
              } catch (err) {
                console.error("Favorites error:", err);
                showToast("Eroare la actualizare favorite.", "error");
              }
            }
          });
        })
        .catch((err) => {
          console.error("map.js: Failed waiting for popup.viewModel:", err);
        });
    });

    // Widgets
    const search = new Search({ view });
    view.ui.add(search, "top-right");

    const locate = new Locate({ view });
    view.ui.add(locate, "top-left");

    view.watch("popup.selectedFeature", (feature) => {
      selectedFacilityGraphic = feature || null;
    });

    // Routing helpers
    function setStartMarker(mapPoint) {
      startLayer.removeAll();
      startLayer.add(
        new Graphic({
          geometry: mapPoint,
          symbol: {
            type: "simple-marker",
            color: [46, 204, 113],
            size: 8,
            outline: { color: [255, 255, 255], width: 1 },
          },
        })
      );
    }

    function setEndMarker(mapPoint) {
      startLayer.add(
        new Graphic({
          geometry: mapPoint,
          symbol: {
            type: "simple-marker",
            color: [231, 76, 60],
            size: 8,
            outline: { color: [255, 255, 255], width: 1 },
          },
        })
      );
    }

    function getLngLat(point) {
      const lon = point.longitude ?? point.x;
      const lat = point.latitude ?? point.y;
      return { lon, lat };
    }

    async function drawRouteBetweenPoints(startPoint, endPoint) {
      if (!startPoint || !endPoint) return;
      routeLayer.removeAll();

      try {
        const routeParams = new RouteParameters({
          stops: new FeatureSet({
            features: [new Graphic({ geometry: startPoint }), new Graphic({ geometry: endPoint })],
          }),
          returnDirections: false,
          outSpatialReference: view.spatialReference,
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
          if (!response.ok) throw new Error("Routing service unavailable");

          const data = await response.json();
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (!coords || coords.length === 0) throw new Error("No route found");

          const polyline = new Polyline({
            paths: [coords],
            spatialReference: { wkid: 4326 },
          });

          const projectedPolyline = view.spatialReference.isWebMercator
            ? webMercatorUtils.geographicToWebMercator(polyline)
            : polyline;

          routeGraphic = new Graphic({
            geometry: projectedPolyline,
            symbol: { type: "simple-line", color: [52, 152, 219, 0.85], width: 4 },
          });
        } else {
          routeGraphic.symbol = { type: "simple-line", color: [52, 152, 219, 0.85], width: 4 };
        }

        routeLayer.add(routeGraphic);
        view.goTo(routeGraphic);
      } catch (error) {
        console.error("Route error:", error);
        showToast("Nu s-a putut calcula ruta. Verifică permisiunea de locație.", success=false);
      }
    }

    // Filter logic
    const typeFilter = document.getElementById("typeFilter");
    if (typeFilter) {
      typeFilter.addEventListener("change", (event) => {
        const selectedType = event.target.value;

        graphicsLayer.graphics.forEach((graphic) => {
          graphic.visible =
            selectedType === "all" || graphic.attributes.type === selectedType;
        });

        const facilityItems = document.querySelectorAll(".facility-item");
        facilityItems.forEach((item) => {
          item.style.display =
            selectedType === "all" || item.dataset.type === selectedType
              ? "block"
              : "none";
        });
      });
    }

    // ADMIN: Add Facility
    let isAddMode = false;
    const addFacilityBtn = document.getElementById("addFacilityBtn");
    const modal = document.getElementById("addFacilityModal");
    const closeBtn = document.querySelector(".close");
    const addFacilityForm = document.getElementById("addFacilityForm");
    const appContainer = document.querySelector(".container");

    const locatorUrl =
      "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

    if (addFacilityBtn) {
      addFacilityBtn.addEventListener("click", () => {
        isAddMode = !isAddMode;

        if (isAddMode) {
          addFacilityBtn.classList.add("active-mode");
          addFacilityBtn.textContent = "Click pe hartă (Anulează)";
          appContainer?.classList.add("add-mode-cursor");
        } else {
          addFacilityBtn.classList.remove("active-mode");
          addFacilityBtn.textContent = "Adaugă facilitate";
          appContainer?.classList.remove("add-mode-cursor");
        }
      });
    }

    view.on("click", (event) => {
      // Add mode
      if (isAddMode) {
        document.getElementById("facLat").value = event.mapPoint.latitude;
        document.getElementById("facLng").value = event.mapPoint.longitude;

        locator
          .locationToAddress(locatorUrl, { location: event.mapPoint })
          .then((response) => {
            let cleanAddress = "";
            if (response.attributes && response.attributes.Address) {
              cleanAddress = response.attributes.Address;
              if (response.attributes.City)
                cleanAddress += ", " + response.attributes.City;
            } else {
              cleanAddress = response.address;
            }
            document.getElementById("facAddress").value = cleanAddress;
            if (modal) modal.style.display = "block";
          })
          .catch((err) => {
            console.error("map.js: Geocoding error:", err);
            document.getElementById("facAddress").value = "";
            if (modal) modal.style.display = "block";
          });

        isAddMode = false;
        addFacilityBtn?.classList.remove("active-mode");
        if (addFacilityBtn) addFacilityBtn.textContent = "Adaugă facilitate";
        appContainer?.classList.remove("add-mode-cursor");
        return;
      }

      // Routing
      const mapPoint = event.mapPoint;
      if (!mapPoint) return;

      const geoPoint = view.spatialReference.isWebMercator
        ? webMercatorUtils.webMercatorToGeographic(mapPoint)
        : mapPoint;

      const { lon, lat } = getLngLat(geoPoint);

      const clickedPoint = new Point({
        longitude: lon,
        latitude: lat,
        spatialReference: { wkid: 4326 },
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

      startPointGeo = null;
      endPointGeo = null;
    });

    if (closeBtn) {
      closeBtn.onclick = () => {
        if (modal) modal.style.display = "none";
      };
    }

    window.onclick = (event) => {
      if (event.target === modal) modal.style.display = "none";
    };

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
          createdBy: "admin",
        };

        try {
          await addDoc(collection(db, "facilities"), newFacility);
          if (modal) modal.style.display = "none";
          addFacilityForm.reset();
          showToast("Facilitatea a fost adăugată cu succes!", "success");
          await loadFacilitiesPoints();
        } catch (error) {
          console.error("map.js: Error adding facility:", error);
          showToast(`Eroare la salvare: ${error?.code || "unknown"}`, "error");
        }
      });
    }

    console.log("map.js: Initialization complete.");
  }
);

import { auth } from './firebase-config.js';

// ArcGIS API Key
const apiKey = "AAPTxy8BH1VEsoebNVZXo8HurJkT0tmZGqmeZW-Op790dOuenTFyF5piiH3bGkds8hStWnKcEwlxt50gYSDGEJhcI23gCFOX-i5YTnPq153nGWwv6weqvxJ1HA1aT0SD7OdBWT8peIW93HKi8CLCyQVdSXOtsgN6_86NsiwliaDmyAiMVEishmcJBqab-u0ELfCb7YQT-aWpMmArcPrytePscNfxQI7CdC1dqij5g8cfYoM.AT1_VbTxb1t6";

require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Search",
    "esri/widgets/Locate"
], function (esriConfig, Map, MapView, FeatureLayer, Search, Locate) {

    esriConfig.apiKey = apiKey;

    const map = new Map({
        basemap: "arcgis/topographic" // basemap styles service
    });

    const view = new MapView({
        map: map,
        center: [26.1025, 44.4268], // Longitude, latitude (Bucharest)
        zoom: 13,
        container: "viewDiv"
    });

    // Define the popup template for facilities
    const popupTemplate = {
        title: "{name}",
        content: [
            {
                type: "fields",
                fieldInfos: [
                    {
                        fieldName: "type",
                        label: "Tip Sport"
                    },
                    {
                        fieldName: "address",
                        label: "Adresă"
                    },
                    {
                        fieldName: "openedHours",
                        label: "Program"
                    }
                ]
            },
            {
                type: "text",
                text: "<a href='details.html?id={OBJECTID}' class='btn' style='display:inline-block; margin-top:10px; text-align:center; color:white; text-decoration:none;'>Vezi Detalii</a>"
            }
        ]
    };

    // Create the FeatureLayer
    // NOTE: This URL is a placeholder. You need to create a Feature Layer in ArcGIS Online
    // and replace this URL with your own hosted feature layer URL.
    // For now, we can use a sample layer or just the setup code.
    // Since we don't have the real URL yet, I'll comment this out and use a GraphicsLayer or just show the map.
    // But per requirements, here is how it should look:

    /*
    const facilitiesLayer = new FeatureLayer({
        url: "YOUR_FEATURE_LAYER_URL_HERE",
        outFields: ["name", "type", "address", "openedHours", "OBJECTID"],
        popupTemplate: popupTemplate
    });
    map.add(facilitiesLayer);
    */

    // Widgets
    const search = new Search({
        view: view
    });
    view.ui.add(search, "top-right");

    const locate = new Locate({
        view: view
    });
    view.ui.add(locate, "top-left");

    // Filter logic (Task 8)
    const typeFilter = document.getElementById("typeFilter");
    const facilityList = document.getElementById("facilityList");

    if (typeFilter) {
        typeFilter.addEventListener("change", function (event) {
            const type = event.target.value;
            // if (facilitiesLayer) {
            //     if (type === "all") {
            //         facilitiesLayer.definitionExpression = null;
            //     } else {
            //         facilitiesLayer.definitionExpression = `type = '${type}'`;
            //     }
            // }
            console.log("Filtering by:", type);
        });
    }

    // Populate sidebar list (Mock data for now since we don't have the layer connected)
    // In a real scenario, we would query the FeatureLayer
    facilityList.innerHTML = "<p>Conectați Feature Layer-ul pentru a vedea facilitățile.</p>";

});

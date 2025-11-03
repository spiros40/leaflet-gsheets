/* global L Papa */

/*
 * Script to display two tables from Google Sheets as point and geometry layers using Leaflet
 * The Sheets are then imported using PapaParse and overwrite the initially loaded layers
 */

// PASTE YOUR URLs HERE
let geomURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1SmQbmmPu6tfv6yWjFn3KAsgmp6w61cZSyj0n_2Gf18-zJozWoH9ibO5iIdEEzNCV_YatKFhMES7R/pub?output=csv";
let pointsURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5_L7aJDIUlWJTIeQLK5y1n_gk726epUZTwvnvB9hHKEYXjVOOlcN-mvlW4kxxPNBdp-nfiCtY24jt/pub?output=csv";

window.addEventListener("DOMContentLoaded", init);

let map;
let sidebar;
let panelID = "my-info-panel";


var userIcon = L.icon({
  iconUrl: "images/user-marker.png", 
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

/*
 * init() is called when the page has loaded
 */
function init() {
  
  map = L.map("map").setView([40.62630117780176, 22.948209679968674], 14);

  
  L.tileLayer(
    "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        "&copy; <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='http://cartodb.com/attributions'>CartoDB</a>",
      subdomains: "abcd",
      maxZoom: 19,
    }
  ).addTo(map);

  // Sidebar
  sidebar = L.control
    .sidebar({
      container: "sidebar",
      closeButton: true,
      position: "right",
    })
    .addTo(map);

  let panelContent = {
    id: panelID,
    tab: "<i class='fa fa-bars active'></i>",
    pane: "<p id='sidebar-content'></p>",
    title: "<h2 id='sidebar-title'>Nothing selected</h2>",
  };
  sidebar.addPanel(panelContent);

  map.on("click", function () {
    sidebar.close(panelID);
  });

  
  Papa.parse(geomURL, {
    download: true,
    header: true,
    complete: addGeoms,
  });
  Papa.parse(pointsURL, {
    download: true,
    header: true,
    complete: addPoints,
  });

  
  function onLocationFound(e) {
    var radius = e.accuracy / 2;

    
    L.marker(e.latlng, { icon: userIcon })
      .addTo(map)
      .bindPopup("📍 Βρίσκεστε εδώ!")
      .openPopup();

    
    L.circle(e.latlng, radius, { color: "#136AEC", fillOpacity: 0.15 }).addTo(
      map
    );
  }

  function onLocationError(e) {
    alert("Δεν ήταν δυνατός ο εντοπισμός της θέσης σας: " + e.message);
  }

  map.on("locationfound", onLocationFound);
  map.on("locationerror", onLocationError);

  map.locate({ setView: true, maxZoom: 16 });
}


function addGeoms(data) {
  data = data.data;
  let fc = {
    type: "FeatureCollection",
    features: [],
  };

  for (let row in data) {
    if (data[row].include == "y") {
      let features = parseGeom(JSON.parse(data[row].geometry));
      features.forEach((el) => {
        el.properties = {
          name: data[row].name,
          description: data[row].description,
        };
        fc.features.push(el);
      });
    }
  }

  let geomStyle = { color: "#2ca25f", fillColor: "#99d8c9", weight: 2 };
  let geomHoverStyle = { color: "green", fillColor: "#2ca25f", weight: 3 };

  L.geoJSON(fc, {
    onEachFeature: function (feature, layer) {
      layer.on({
        mouseout: function (e) {
          e.target.setStyle(geomStyle);
        },
        mouseover: function (e) {
          e.target.setStyle(geomHoverStyle);
        },
        click: function (e) {
          L.DomEvent.stopPropagation(e);
          document.getElementById("sidebar-title").innerHTML =
            e.target.feature.properties.name;
          document.getElementById("sidebar-content").innerHTML =
            e.target.feature.properties.description;
          sidebar.open(panelID);
        },
      });
    },
    style: geomStyle,
  }).addTo(map);
}


function addPoints(data) {
  data = data.data;
  let pointGroupLayer = L.layerGroup().addTo(map);
  let markerType = "marker";
  let markerRadius = 100;
  let distanceLimit = 1000; 

  
  let referencePoint = [40.6263, 22.9482];

  //try to find user
  map.locate({ setView: false, maxZoom: 16 });

  //position finded
  map.on("locationfound", function (e) {
    referencePoint = [e.latitude, e.longitude];
    showNearbyPoints();
  });

  // fail to find
  map.on("locationerror", function () {
    alert("Δεν ήταν δυνατός ο εντοπισμός της θέσης σας — θα χρησιμοποιηθεί σημείο αναφοράς στη Θεσσαλονίκη.");
    showNearbyPoints();
  });

  function showNearbyPoints() {
    for (let row = 0; row < data.length; row++) {
      let lat = parseFloat(data[row].lat);
      let lon = parseFloat(data[row].lon);
      if (isNaN(lat) || isNaN(lon)) continue;

      // calculate 
      let distance = map.distance(referencePoint, [lat, lon]);

      // nearby points
      if (distance <= distanceLimit) {
        let marker;
        if (markerType == "circleMarker") {
          marker = L.circleMarker([lat, lon], { radius: markerRadius });
        } else if (markerType == "circle") {
          marker = L.circle([lat, lon], { radius: markerRadius });
        } else {
          marker = L.marker([lat, lon]);
        }

        //icon
        let icon = L.AwesomeMarkers.icon({
          icon: "map-marker-alt",
          iconColor: "white",
          markerColor: data[row].color || "blue",
          prefix: "fa",
        });
        if (!markerType.includes("circle")) marker.setIcon(icon);

        // sidebar
        marker.feature = {
          properties: {
            name: data[row].name,
            description: data[row].description,
          },
        };

        marker.on({
          click: function (e) {
            L.DomEvent.stopPropagation(e);
            document.getElementById("sidebar-title").innerHTML =
              e.target.feature.properties.name;
            document.getElementById("sidebar-content").innerHTML =
              e.target.feature.properties.description;
            sidebar.open(panelID);
          },
        });

        marker.addTo(pointGroupLayer);
      }
    }
  }
}


function parseGeom(gj) {
  if (gj.type == "FeatureCollection") {
    return gj.features;
  } else if (gj.type == "Feature") {
    return [gj];
  } else if ("type" in gj) {
    return [{ type: "Feature", geometry: gj }];
  } else {
    let type;
    if (typeof gj[0] == "number") {
      type = "Point";
    } else if (typeof gj[0][0] == "number") {
      type = "LineString";
    } else if (typeof gj[0][0][0] == "number") {
      type = "Polygon";
    } else {
      type = "MultiPolygon";
    }
    return [{ type: "Feature", geometry: { type: type, coordinates: gj } }];
  }
}

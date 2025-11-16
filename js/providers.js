// Initialize Leaflet map, query Overpass API for nearby healthcare nodes, and add markers.
// This example uses browser geolocation to get center; if denied, uses a default location.
window.initProviders = async function(){
  if(window._providersInit) return; // don't init twice
  window._providersInit = true;

  const mapDiv = document.getElementById('map');
  mapDiv.innerHTML = '';
  const map = L.map('map').setView([40.7, -73.9], 12); // default center
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  function showMarkers(center){
    const [lat, lon] = center;
    const radiusMeters = 5000;
    const overpassQuery = `[out:json][timeout:25];
      (
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        node["healthcare"="doctor"](around:${radiusMeters},${lat},${lon});
        node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      );
      out body;`;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);
    fetch(url).then(r=>r.json()).then(data=>{
      if(!data.elements || data.elements.length===0){
        alert('No providers found in area');
        return;
      }
      data.elements.forEach(el => {
        const m = L.marker([el.lat, el.lon]).addTo(map);
        const name = el.tags && (el.tags.name || el.tags.official_name) || 'Provider';
        const info = `<strong>${name}</strong><div>${el.tags && el.tags.address || ''}</div>`;
        m.bindPopup(info);
      });
      map.setView([lat,lon],13);
    }).catch(err => {
      console.error(err);
      alert('Error loading provider data');
    });
  }

  if('geolocation' in navigator){
    navigator.geolocation.getCurrentPosition(pos => {
      showMarkers([pos.coords.latitude, pos.coords.longitude]);
      L.circle([pos.coords.latitude, pos.coords.longitude], {radius: 40, color:'blue'}).addTo(map);
    }, err => {
      // fallback: sample coordinates (e.g., New York)
      showMarkers([40.7128, -74.0060]);
    });
  } else {
    showMarkers([40.7128, -74.0060]);
  }
};
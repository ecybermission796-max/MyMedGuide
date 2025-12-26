// Initialize Leaflet map, query Overpass API for nearby healthcare facilities, and add numbered markers.
// Updates results dynamically when map is moved or zoomed.
window.initProviders = async function(){
  if(window._providersInit) return; // don't init twice
  window._providersInit = true;

  const mapDiv = document.getElementById('map');
  mapDiv.innerHTML = '';
  
  // Create map container and results panel
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '10px';
  container.style.height = '70vh';
  
  const mapContainer = document.createElement('div');
  mapContainer.id = 'map-container';
  mapContainer.style.flex = '1';
  mapContainer.style.minWidth = '60%';
  
  const resultsPanel = document.createElement('div');
  resultsPanel.id = 'results-panel';
  resultsPanel.style.flex = '0 0 35%';
  resultsPanel.style.overflowY = 'auto';
  resultsPanel.style.padding = '10px';
  resultsPanel.style.background = '#f9f9f9';
  resultsPanel.style.borderRadius = '8px';
  resultsPanel.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Move the map to search for providers</div>';
  
  container.appendChild(mapContainer);
  container.appendChild(resultsPanel);
  mapDiv.appendChild(container);
  
  const map = L.map('map-container').setView([40.7, -73.9], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let markers = [];
  let currentProviders = [];
  let debounceTimer = null;
  let isLoading = false;
  
  // Calculate distance in miles between two lat/lon points
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  // Create custom numbered icon
  function createNumberedIcon(number) {
    return L.divIcon({
      className: 'numbered-marker',
      html: `<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${number}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }
  
  // Helper function to filter providers
  function filterProvider(name, el) {
    const nameLower = name.toLowerCase();
    const excludeKeywords = ['senior care', 'speech clinic', 'diagnostic', 'plastic surgery', 
                             'cosmetic surgery', 'rehabilitation', 'integrative care', 
                             'assisted living', 'nursing home', 'speech therapy', 'orthopaedic',
                             'orthopedic'];
    return !excludeKeywords.some(keyword => nameLower.includes(keyword));
  }
  
  // Fast amenity-based search for initial load
  async function searchByAmenity(lat, lon, radiusMeters) {
    const overpassQuery = `[out:json][timeout:5];
      (
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      );
      out center;`;
    
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);
    
    const r = await fetch(url);
    if(!r.ok) {
      if(r.status === 429) throw new Error('Too many requests. Please wait a moment.');
      if(r.status === 504) throw new Error('Request timeout. Try zooming in for a smaller area.');
      throw new Error(`API error: ${r.status}`);
    }
    
    const data = await r.json();
    return data.elements || [];
  }
  
  // Helper function to search by keyword (for supplementary searches)
  async function searchByKeyword(keyword, lat, lon, radiusMeters) {
    const overpassQuery = `[out:json][timeout:5];
      (
        node["name"~"${keyword}",i]["amenity"~"hospital|clinic"](around:${radiusMeters},${lat},${lon});
        way["name"~"${keyword}",i]["amenity"~"hospital|clinic"](around:${radiusMeters},${lat},${lon});
      );
      out center;`;
    
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);
    
    const r = await fetch(url);
    if(!r.ok) {
      if(r.status === 429) throw new Error('Too many requests. Please wait a moment.');
      if(r.status === 504) throw new Error('Request timeout. Try zooming in for a smaller area.');
      throw new Error(`API error: ${r.status}`);
    }
    
    const data = await r.json();
    return data.elements || [];
  }
  
  // Process elements into provider objects
  function processElements(elements, lat, lon, defaultType = null) {
    return elements.map(el => {
      const providerLat = el.lat || (el.center && el.center.lat);
      const providerLon = el.lon || (el.center && el.center.lon);
      const distance = calculateDistance(lat, lon, providerLat, providerLon);
      const name = (el.tags && (el.tags.name || el.tags.official_name)) || null;
      
      // Skip if no name
      if(!name) return null;
      
      const nameLower = name.toLowerCase();
      
      if(!filterProvider(name, el)) return null;
      
      // Calculate address
      const address = el.tags && el.tags['addr:full'] || 
                     (el.tags && `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street'] || ''} ${el.tags['addr:city'] || ''}`.trim()) || 
                     null;
      
      // Skip if no address
      if(!address) return null;
      
      // Determine facility type
      let facilityType = defaultType || 'Healthcare Facility';
      if(!defaultType) {
        if(el.tags && el.tags.amenity === 'hospital' || nameLower.includes('hospital')) {
          facilityType = 'Hospital';
        } else if(nameLower.includes('urgent care')) {
          facilityType = 'Urgent Care';
        } else if(nameLower.includes('emergency')) {
          facilityType = 'Emergency Room';
        } else if(nameLower.includes('medical center')) {
          facilityType = 'Medical Center';
        } else if(nameLower.includes('ambulatory')) {
          facilityType = 'Ambulatory Care';
        } else if(el.tags && el.tags.amenity === 'clinic') {
          facilityType = 'Clinic';
        }
      }
      
      return {
        lat: providerLat,
        lon: providerLon,
        name: name,
        type: facilityType,
        address: address,
        phone: el.tags && el.tags.phone || '',
        distance: distance
      };
    }).filter(p => p !== null);
  }
  
  // Display results and markers
  function displayResults(providers) {
    // Update current providers
    currentProviders = providers;
    
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    // Add numbered markers
    providers.forEach((provider, index) => {
      const number = index + 1;
      const marker = L.marker([provider.lat, provider.lon], {
        icon: createNumberedIcon(number)
      }).addTo(map);
      
      const info = `
        <div style="min-width:200px;">
          <strong>${number}. ${provider.name}</strong><br>
          <small>${provider.type}</small><br>
          ${provider.address}<br>
          ${provider.phone ? `Tel: ${provider.phone}<br>` : ''}
          <em>${provider.distance.toFixed(2)} miles away</em>
        </div>
      `;
      marker.bindPopup(info);
      
      // Scroll to corresponding result when marker is clicked
      marker.on('click', () => {
        const resultDiv = document.getElementById(`provider-${index}`);
        if(resultDiv) {
          resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
          resultDiv.style.background = '#ffe0e0';
          setTimeout(() => {
            resultDiv.style.background = 'white';
          }, 1500);
        }
      });
      
      markers.push(marker);
    });
    
    // Display results list
    let resultsHTML = `<div style="margin-bottom:10px; font-weight:bold; border-bottom: 2px solid #e74c3c; padding-bottom:5px;">Found ${providers.length} provider(s)</div>`;
    providers.forEach((provider, index) => {
      const number = index + 1;
      resultsHTML += `
        <div id="provider-${index}" style="margin-bottom:15px; padding:10px; background:white; border-radius:5px; border-left: 3px solid #e74c3c; cursor:pointer; transition: background 0.3s;" 
             onclick="document.querySelectorAll('.leaflet-marker-icon')[${index}].click()">
          <div style="display:flex; align-items:start;">
            <div style="background:#e74c3c; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-weight:bold; margin-right:10px; flex-shrink:0;">${number}</div>
            <div style="flex:1;">
              <strong>${provider.name}</strong><br>
              <small style="color:#666;">${provider.type}</small><br>
              <small>${provider.address}</small><br>
              ${provider.phone ? `<small>📞 ${provider.phone}</small><br>` : ''}
              <small style="color:#e74c3c; font-weight:bold;">📍 ${provider.distance.toFixed(2)} mi</small>
            </div>
          </div>
        </div>
      `;
    });
    resultsPanel.innerHTML = resultsHTML;
  }
  
  async function showMarkers(center, radiusMiles = 10){
    // Prevent concurrent requests
    if(isLoading) return;
    isLoading = true;
    
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    const [lat, lon] = center;
    const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters
    
    resultsPanel.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Loading providers...</div>';
    
    try {
      // Start with fast amenity-based search for hospitals and clinics
      const amenityElements = await searchByAmenity(lat, lon, radiusMeters);
      let allProviders = processElements(amenityElements, lat, lon);
      
      // Display initial results immediately
      if(allProviders.length > 0) {
        allProviders.sort((a, b) => a.distance - b.distance);
        displayResults(allProviders.slice(0, 20));
      }
      
      // Release the loading lock so pan movements can trigger new searches
      isLoading = false;
      
      // If we don't have 20 results, supplement with keyword searches in background
      if(allProviders.length < 20) {
        const searchOrder = [
          { keyword: 'emergency room', type: 'Emergency Room' },
          { keyword: 'hospital', type: 'Hospital' },
          { keyword: 'medical center', type: 'Medical Center' },
          { keyword: 'urgent care', type: 'Urgent Care' },
          { keyword: 'ambulatory care', type: 'Ambulatory Care' }
        ];
        
        for(const search of searchOrder) {
          if(allProviders.length >= 20) break;
          
          try {
            const elements = await searchByKeyword(search.keyword, lat, lon, radiusMeters);
            const providers = processElements(elements, lat, lon, search.type);
            
            // Add new providers (avoid duplicates)
            providers.forEach(p => {
              const isDuplicate = allProviders.some(existing => 
                Math.abs(existing.lat - p.lat) < 0.0001 && Math.abs(existing.lon - p.lon) < 0.0001
              );
              if(!isDuplicate) {
                allProviders.push(p);
              }
            });
            
            // Update display with new results
            if(providers.length > 0) {
              allProviders.sort((a, b) => a.distance - b.distance);
              displayResults(allProviders.slice(0, 20));
            }
          } catch(err) {
            console.warn(`Keyword search for ${search.keyword} failed:`, err);
            // Continue with other searches
          }
        }
      }
      
      if(allProviders.length === 0) {
        resultsPanel.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">No providers found in this area</div>';
        return;
      }
      
    } catch(err) {
      isLoading = false;
      console.error(err);
      resultsPanel.innerHTML = `<div style="color:#d32f2f; padding:20px; background:white; border-radius:5px; text-align:center;">
        <strong>Error loading providers</strong><br>
        <small>${err.message}</small><br>
        <small style="color:#666;">Try zooming in or waiting a moment before moving the map again.</small>
      </div>`;
    }
  }
  
  // Update results when map moves or zooms (with debouncing)
  function updateResults() {
    // Clear existing timer
    if(debounceTimer) clearTimeout(debounceTimer);
    
    // Wait 2 seconds after user stops moving/zooming before making request
    debounceTimer = setTimeout(() => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      // Adjust radius based on zoom level (more zoom = smaller radius)
      let radius = 5; // default 5 miles
      if(zoom > 13) radius = 3;
      if(zoom > 15) radius = 1.5;
      if(zoom < 11) radius = 10;
      
      showMarkers([center.lat, center.lng], radius);
    }, 2000); // 2 second debounce
  }
  
  // Add event listeners for map interaction
  map.on('moveend', updateResults);
  map.on('zoomend', updateResults);

  // Initial location setup
  if('geolocation' in navigator){
    navigator.geolocation.getCurrentPosition(pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 13);
      L.circle([pos.coords.latitude, pos.coords.longitude], {radius: 40, color:'blue'}).addTo(map);
      updateResults();
    }, err => {
      // fallback: sample coordinates (e.g., New York)
      map.setView([40.7128, -74.0060], 13);
      updateResults();
    });
  } else {
    map.setView([40.7128, -74.0060], 13);
    updateResults();
  }
};
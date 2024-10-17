const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const svgImage = new Image();
const markerImage = new Image();
const markerRedImage = new Image();
svgImage.src = 'resources/ee.svg';
markerImage.src = 'resources/marker.svg';
markerRedImage.src = 'resources/markerRed.svg';

let scale = 1;
let originX = 0;
let originY = 0;
let isDragging = false;
let startX, startY;
let markers = [];
let lastClickedMarker = null;
let nearestMarker = null;
let nearestMarkerName = '';

const topLeft = { lat: 59.69, lng: 21.78 };
const bottomRight = { lat: 57.45, lng: 28.2 };

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function latLngToPixels(lat, lng) {
    const mapWidth = svgImage.width;
    const mapHeight = svgImage.height;
    const latRange = topLeft.lat - bottomRight.lat;
    const lngRange = bottomRight.lng - topLeft.lng;
    const x = ((lng - topLeft.lng) / lngRange) * mapWidth;
    const y = mapHeight - ((lat - bottomRight.lat) / latRange) * mapHeight;
    return { x, y };
}

function pixelsToLatLng(x, y) {
    const mapWidth = svgImage.width;
    const mapHeight = svgImage.height;
    const latRange = topLeft.lat - bottomRight.lat;
    const lngRange = bottomRight.lng - topLeft.lng;
    const lat = topLeft.lat - (y / mapHeight) * latRange;
    const lng = topLeft.lng + (x / mapWidth) * lngRange;
    return { lat, lng };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

fetch('markers.json')
    .then(response => response.json())
    .then(data => {
        markers = data.map(marker => ({
            ...marker,
            ...latLngToPixels(marker.lat, marker.lng)
        }));
        draw();
    })
    .catch(error => console.error('ERR:', error));

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);
    ctx.drawImage(svgImage, 0, 0);
    ctx.restore();

    markers.forEach(marker => {
        drawMarker(marker.x, marker.y, marker.n, marker.isRed);
    });

    if (lastClickedMarker && nearestMarker) {
        drawLineWithDistance(lastClickedMarker, nearestMarker);
    }

    drawNearestMarkerText();
}

function drawMarker(x, y, name, isRed = false) {
    const markerSize = 16;
    const adjustedX = (x * scale) + originX - (markerSize / 2);
    const adjustedY = (y * scale) + originY - (markerSize / 2);
    const markerToDraw = isRed ? markerRedImage : markerImage;
    ctx.drawImage(markerToDraw, adjustedX, adjustedY, markerSize, markerSize);
    if (scale > 1.5) {
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial'
        ctx.fillText(name, adjustedX + markerSize + 2, adjustedY + markerSize / 2);
    }
}

function drawLineWithDistance(marker1, marker2) {
    ctx.save();
    ctx.beginPath();
    const x1 = (marker1.x * scale) + originX;
    const y1 = (marker1.y * scale) + originY;
    const x2 = (marker2.x * scale) + originX;
    const y2 = (marker2.y * scale) + originY;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const distance = calculateDistance(marker1.lat, marker1.lng, marker2.lat, marker2.lng).toFixed(2);
    ctx.font = '14px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(`${distance} km`, midX, midY - 5);
    ctx.restore();
}

function drawNearestMarkerText() {
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'white';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    ctx.fillText(`Lähim COOP: ${nearestMarkerName}`, 10, 30);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}


canvas.addEventListener('click', (event) => {
    const mouseX = (event.clientX - originX) / scale;
    const mouseY = (event.clientY - originY) / scale;
    const { lat, lng } = pixelsToLatLng(mouseX, mouseY);
    const newMarker = { lat, lng, n: '', ...latLngToPixels(lat, lng), isRed: true };
    if (lastClickedMarker !== null) {
        markers = markers.filter(marker => marker !== lastClickedMarker);
    }
    markers.push(newMarker);
    lastClickedMarker = newMarker;
    draw();

    nearestMarker = null;
    let shortestDistance = Infinity;
    markers.forEach(marker => {
        if (marker !== newMarker && !marker.isRed) {
            const distance = calculateDistance(lat, lng, marker.lat, marker.lng);
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestMarker = marker;
            }
        }
    });

    if (nearestMarker) {
        nearestMarkerName = nearestMarker.n;
    }

    draw();
});

canvas.addEventListener('wheel', (event) => {
    const zoomFactor = 0.1;
    const previousScale = scale;
    scale += event.deltaY * -0.001;
    scale = Math.min(Math.max(0.5, scale), 5);

    const mouseX = event.clientX - originX;
    const mouseY = event.clientY - originY;

    const zoomRatio = scale / previousScale;
    originX -= mouseX * (zoomRatio - 1);
    originY -= mouseY * (zoomRatio - 1);

    draw();
});

canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    startX = event.clientX - originX;
    startY = event.clientY - originY;
});

canvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
        originX = event.clientX - startX;
        originY = event.clientY - startY;
        draw();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

svgImage.onload = () => {
    originX = (canvas.width - svgImage.width) / 2;
    originY = (canvas.height - svgImage.height) / 2;
    draw();
};

markerImage.onload = () => {
    draw();
};

markerRedImage.onload = () => {
    draw();
};

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
});

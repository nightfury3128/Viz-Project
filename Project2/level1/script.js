
const L1_DATA_PATH = "data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv";

var l1Data; 

var tooltip = d3.select("#tooltip");

// who to call when any filter changes
var filterListeners = [];

var timeBrushRange = null;
var mapBrushIds = null;

var barFilters = {
    neighborhood: new Set(),
    method_received: new Set(),
    dept_name: new Set(),
    priority: new Set(),
    sr_major_category: new Set(),
    sr_type_desc: new Set()
};

var mapColorBy = "days_to_close";
var mapRenderMode = "points";
var serviceFocus = "graffiti";
var animationCutoffDate = null;
var animationTimer = null;
var minCreatedDate = null;
var maxCreatedDate = null;

var leafletMap;
var tileLayers;
var activeTileLayer;
var mapSvgOverlay;
var dotGroup;
var heatGroup;
var mapBrushLayer;
var brushRect;

var rightDragSelecting = { active: false, x0: 0, y0: 0 }; 

function filterlistener(callback) {
    filterListeners.push(callback); // Linking the graphs and maps 
}

function getMajorCategory(d) {
    var full = (d.sr_type_desc || d.sr_type || "Unknown").toUpperCase();
    if (full.includes("POTHOLE")) return "Potholes";
    if (full.includes("GRAFFITI")) return "Graffiti";
    if (full.includes("TRASH") || full.includes("BULK")) return "Trash / Bulk";
    if (full.includes("LIGHT")) return "Lighting";
    if (full.includes("WATER")) return "Water";
    if (full.includes("SIGN")) return "Signs";
    if (full.includes("BUILDING") || full.includes("ZONING")) return "Building / Zoning";
    if (full.includes("TREE") || full.includes("GRASS") || full.includes("VEGETATION")) return "Vegetation";
    if (full.includes("SEWER") || full.includes("DRAIN")) return "Sewer / Drainage";
    return "Other";
}

function refreshLinkedCharts() {
    filterListeners.forEach(function(fn) {
        fn();
    });
    createMapPoints(); // This is to make sure that map is updated when the filters changes
}

function isGraffitiRequest(d) {
    var s = ((d.sr_type_desc || "") + " " + (d.sr_type || "")).toUpperCase();
    return s.includes("GRAFFITI");
}

function isPotholeRequest(d) {
    var s = ((d.sr_type_desc || "") + " " + (d.sr_type || "")).toUpperCase();
    return s.includes("POTHOLE");
}

function rowHasCoords(d) {
    return d.latitude != null && d.longitude != null && !isNaN(d.latitude) && !isNaN(d.longitude);
}

function coordsInsideBounds(d, bounds) {
    if (!bounds || !rowHasCoords(d)) return false;
    return bounds.contains(L.latLng(d.latitude, d.longitude));
}

function getFilteredRows(options) { // Cursor helped a lot with this function since I couldn't get the bonus feature to work properly for some reason 
    var opts = options || {};
    var ignore = opts.ignore || []; 
    var clipToMap = opts.clipToMap === true; // This is for bonus feature that limits the graph to the how the map is zoom by the user
    var bounds = clipToMap && leafletMap ? leafletMap.getBounds() : null;

    return l1Data.filter(function(d) {
        if (!ignore.includes("timeline") && timeBrushRange) {
            var t0 = timeBrushRange[0];
            var t1 = timeBrushRange[1];
            if (d.date_created < t0 || d.date_created > t1) return false;
        }

        if (!ignore.includes("map") && mapBrushIds) {
            if (!mapBrushIds.has(d.sr_number)) return false;
        }

        if (!ignore.includes("attributes")) {
            for (var key in barFilters) {
                if (barFilters[key].size === 0) continue;
                if (!barFilters[key].has(d[key])) return false;
            }
        }

        if (!ignore.includes("serviceFocus")) {
            if (serviceFocus === "graffiti") {
                if (!isGraffitiRequest(d)) return false;
            } else if (serviceFocus === "potholes") {
                if (!isPotholeRequest(d)) return false;
            } else if (serviceFocus === "both") {
                if (!(isGraffitiRequest(d) || isPotholeRequest(d))) return false;
            }
        }

        if (!ignore.includes("animation") && animationCutoffDate && d.date_created > animationCutoffDate) {
            return false;
        }

        if (bounds && rowHasCoords(d) && !coordsInsideBounds(d, bounds)) {
            return false;
        }

        return true;
    });
}

function setTimeBrushRange(range) {
    timeBrushRange = range;
    refreshLinkedCharts();
}

function setMapBrushIds(idsSetOrNull) {
    mapBrushIds = idsSetOrNull;
    refreshLinkedCharts();
}

function toggleBarCategory(attribute, category) {
    var set = barFilters[attribute];
    if (!set) return;
    if (set.has(category)) set.delete(category);
    else set.add(category);
    refreshLinkedCharts();
}

function getBarCategorySet(attribute) {
    return barFilters[attribute] || new Set();
}

function resetAllFilters() {
    timeBrushRange = null;
    mapBrushIds = null;
    Object.keys(barFilters).forEach(function(key) {
        barFilters[key].clear();
    });
    stopAnimation();
    animationCutoffDate = null;
    syncAnimationControls();
    hideBrushRect();
    refreshLinkedCharts();
}

function setMapColorByField(field) {
    mapColorBy = field;
    createMapPoints();
}

function setMapRenderMode(mode) {
    mapRenderMode = mode;
    createMapPoints();
}

function setServiceFocus(next) {
    serviceFocus = next;
    stopAnimation();
    animationCutoffDate = null;
    syncAnimationControls();
    refreshLinkedCharts();
}

function convertCsvRow(d) {
    var parseIsoDate = d3.timeParse("%Y-%m-%d");
    var parsePortalDate = d3.timeParse("%Y %b %d %I:%M:%S %p");
    var created = d.DATE_CREATED ? parsePortalDate(d.DATE_CREATED) : parseIsoDate(d.date_created || "");
    var closed = d.DATE_CLOSED ? parsePortalDate(d.DATE_CLOSED) : parseIsoDate(d.date_closed || "");
    var desc = (d.SR_TYPE_DESC || d.sr_type_desc || "Unknown").trim();
    var srType = (d.SR_TYPE || d.sr_type || "Unknown").trim();
    var planned = +(d.PLANNED_COMPLETION_DAYS || d.planned_completion_days);
    var lat = d.LATITUDE !== undefined ? +d.LATITUDE : +d.latitude;
    var lon = d.LONGITUDE !== undefined ? +d.LONGITUDE : +d.longitude;
    var daysToClose = closed && created ? Math.floor((closed - created) / (1000 * 60 * 60 * 24)) : null;

    return {
        sr_number: d.SR_NUMBER || d.sr_number,
        sr_type: srType,
        sr_type_desc: desc,
        sr_major_category: getMajorCategory({ sr_type: srType, sr_type_desc: desc }),
        priority: d.PRIORITY || d.priority || "Unknown",
        dept_name: d.DEPT_NAME || d.dept_name || "Unknown",
        method_received: d.METHOD_RECEIVED || d.method_received || "Unknown",
        neighborhood: d.NEIGHBORHOOD || d.neighborhood || "Unknown",
        time_received: d.TIME_RECEIVED || d.time_received || "",
        date_created: created,
        date_closed: closed,
        planned_completion_days: isNaN(planned) ? null : planned,
        days_to_close: daysToClose == null || daysToClose < 0 ? null : daysToClose,
        latitude: isNaN(lat) ? null : lat,
        longitude: isNaN(lon) ? null : lon
    };
}

function setupLeafletMap() {
    leafletMap = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([39.11, -84.51], 12);

    tileLayers = {
        streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors"
        }),
        light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: "&copy; OpenStreetMap &copy; CARTO"
        }),
        satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            attribution: "Tiles &copy; Esri"
        })
    };

    activeTileLayer = tileLayers.streets.addTo(leafletMap);

    mapSvgOverlay = d3.select("#mapContainer")
        .append("svg")
        .attr("class", "map-overlay");

    dotGroup = mapSvgOverlay.append("g").attr("class", "points-layer");
    heatGroup = mapSvgOverlay.append("g").attr("class", "heat-layer");
    mapBrushLayer = mapSvgOverlay.append("g").attr("class", "brush-layer");

    leafletMap.on("zoom move resize", function() {
        resizeSvgOverlay();
        createMapPoints();
    });

    leafletMap.on("zoomend moveend", function() {
        refreshLinkedCharts();
    });

    resizeSvgOverlay();
    setupRightDragBrush();
    hookSvgWheelToMap();

    function fixMapSizeAfterLayout() {
        if (!leafletMap) return;
        leafletMap.invalidateSize({ animate: false });
        resizeSvgOverlay();
        createMapPoints();
    }

    requestAnimationFrame(fixMapSizeAfterLayout);
    setTimeout(fixMapSizeAfterLayout, 200);
    window.addEventListener("resize", fixMapSizeAfterLayout);
}

function passWheelToLeaflet(event) {
    if (!leafletMap || !leafletMap.options.scrollWheelZoom) return;
    var h = leafletMap.scrollWheelZoom;
    if (!h || !h._enabled) return;
    if (typeof h._onWheelScroll === "function") {
        h._onWheelScroll.call(h, event);
        return;
    }
    var dz = event.deltaY > 0 ? -1 : 1;
    leafletMap.setZoom(leafletMap.getZoom() + dz);
}

function hookSvgWheelToMap() {
    var node = mapSvgOverlay.node();
    if (!node) return;
    node.addEventListener("wheel", passWheelToLeaflet, { passive: false, capture: true });
}

function resizeSvgOverlay() {
    var size = leafletMap.getSize();
    mapSvgOverlay.attr("width", size.x).attr("height", size.y);
    hideBrushRect();
}

function hideBrushRect() {
    if (brushRect) {
        brushRect.attr("visibility", "hidden").attr("width", 0).attr("height", 0);
    }
}

function onRightDragMove(event) { // This is to allow users to map the map around without having to brush
    if (!rightDragSelecting.active || !brushRect) return;
    var pt = d3.pointer(event, mapSvgOverlay.node());
    var x0 = rightDragSelecting.x0;
    var y0 = rightDragSelecting.y0;
    var x1 = pt[0];
    var y1 = pt[1];
    brushRect
        .attr("x", Math.min(x0, x1))
        .attr("y", Math.min(y0, y1))
        .attr("width", Math.abs(x1 - x0))
        .attr("height", Math.abs(y1 - y0));
}

function finishRightDragBrush() { // This is to finish the right drag brush and set the map brush ids to null
    window.removeEventListener("mousemove", onRightDragMove);
    window.removeEventListener("mouseup", finishRightDragBrush, true);
    if (!rightDragSelecting.active) return;
    rightDragSelecting.active = false;

    var node = brushRect && brushRect.node();
    if (!node) return;
    var w = +node.getAttribute("width");
    var h = +node.getAttribute("height");
    if (w < 4 || h < 4) {
        hideBrushRect();
        setMapBrushIds(null);
        return;
    }

    var x0 = +node.getAttribute("x");
    var y0 = +node.getAttribute("y");
    var x1 = x0 + w;
    var y1 = y0 + h;

    var pool = getFilteredRows({ ignore: ["map"] });
    var picked = new Set();
    pool.forEach(function(d) {
        if (d.latitude == null || d.longitude == null) return;
        var p = leafletMap.latLngToContainerPoint([d.latitude, d.longitude]);
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) {
            picked.add(d.sr_number);
        }
    });

    hideBrushRect();
    setMapBrushIds(picked.size ? picked : null);
}

function onMapBoxRightMouseDown(event) {
    if (event.button !== 2) return;
    if (!mapSvgOverlay || !brushRect) return;
    event.preventDefault();
    event.stopPropagation();

    var pt = d3.pointer(event, mapSvgOverlay.node());
    rightDragSelecting.active = true;
    rightDragSelecting.x0 = pt[0];
    rightDragSelecting.y0 = pt[1];

    brushRect
        .attr("visibility", "visible")
        .attr("x", pt[0])
        .attr("y", pt[1])
        .attr("width", 0)
        .attr("height", 0);

    window.addEventListener("mousemove", onRightDragMove);
    window.addEventListener("mouseup", finishRightDragBrush, true);
}

function setupRightDragBrush() {
    mapBrushLayer.selectAll("*").remove();
    brushRect = mapBrushLayer.append("rect")
        .attr("class", "map-brush-selection")
        .attr("visibility", "hidden")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0)
        .attr("height", 0);

    var el = document.getElementById("mapContainer");
    if (!el) return;

    el.addEventListener("contextmenu", function(e) {
        e.preventDefault();
    });
    el.addEventListener("mousedown", onMapBoxRightMouseDown, true);
}

function buildColorScale(colorBy, data) {
    if (colorBy === "days_to_close") {
        var values = data
            .map(function(d) { return d.days_to_close; })
            .filter(function(v) { return v != null && !isNaN(v); });
        var domain = d3.extent(values);
        if (!domain[0] && !domain[1]) domain = [0, 1];
        return {
            kind: "numbers",
            scale: d3.scaleSequential(d3.interpolateTurbo).domain(domain),
            domain: domain
        };
    }

    var cats = Array.from(new Set(data.map(function(d) { return d[colorBy] || "Unknown"; })));
    cats.sort(d3.ascending);
    return {
        kind: "categories",
        scale: d3.scaleOrdinal(d3.schemeTableau10).domain(cats),
        categories: cats
    };
}

function drawMapHeatmap(withCoords) {
    dotGroup.selectAll("*").remove();
    var cellSize = 26;
    var bins = {};

    withCoords.forEach(function(d) {
        var p = leafletMap.latLngToContainerPoint([d.latitude, d.longitude]);
        var gx = Math.floor(p.x / cellSize);
        var gy = Math.floor(p.y / cellSize);
        var key = gx + "|" + gy;
        bins[key] = (bins[key] || 0) + 1;
    });

    var cells = Object.keys(bins).map(function(key) {
        var parts = key.split("|");
        return {
            gx: +parts[0],
            gy: +parts[1],
            count: bins[key]
        };
    });

    var maxCount = d3.max(cells, function(d) { return d.count; }) || 1;
    var heatScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([1, maxCount]);

    heatGroup.selectAll("rect")
        .data(cells, function(d) { return d.gx + "|" + d.gy; })
        .join("rect")
        .attr("x", function(d) { return d.gx * cellSize; })
        .attr("y", function(d) { return d.gy * cellSize; })
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("fill", function(d) { return heatScale(d.count); })
        .attr("fill-opacity", function(d) { return 0.2 + (d.count / maxCount) * 0.65; });

    drawMapLegend({
        kind: "numbers",
        domain: [1, maxCount],
        scale: heatScale,
        labelSuffix: " calls / cell"
    });
}

function createMapPoints() { // CURSOR TOOK OVER THIS FUNCTION SINCE I COULD NOT GET THE PROPER CIRCLE SIZE WITHOUT IT LOOKING TERRIBLE (I DO NOT HAVE ANY ARTISTIC SKILLS)
    var filtered = getFilteredRows();
    var withCoords = filtered.filter(function(d) {
        return d.latitude != null && d.longitude != null && !isNaN(d.latitude) && !isNaN(d.longitude);
    });
    var unmappedCount = filtered.length - withCoords.length;
    var coordsInfoEl = document.getElementById("mapCoordsInfo");
    if (coordsInfoEl) {
        coordsInfoEl.textContent = "Mapped: " + withCoords.length + " | Missing GPS: " + unmappedCount;
    }

    if (mapRenderMode === "heatmap") {
        drawMapHeatmap(withCoords);
        return;
    }

    heatGroup.selectAll("*").remove();

    var colorInfo = buildColorScale(mapColorBy, withCoords.length ? withCoords : l1Data);
    var colorScale = colorInfo.scale;

    var dots = dotGroup.selectAll("circle")
        .data(withCoords, function(d) { return d.sr_number; });

    dots.exit().remove();

    var entered = dots.enter().append("circle")
        .attr("class", "request-dot")
        .attr("r", 4.5)
        .attr("opacity", 0.86)
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px")
                .html(
                    "<strong>" + d.sr_type_desc + "</strong><br>" +
                    "Request #: " + d.sr_number + "<br>" +
                    "Created: " + d3.timeFormat("%b %d, %Y")(d.date_created) + "<br>" +
                    "Closed: " + (d.date_closed ? d3.timeFormat("%b %d, %Y")(d.date_closed) : "Open") + "<br>" +
                    "Dept: " + d.dept_name + "<br>" +
                    "Priority: " + d.priority + "<br>" +
                    "Neighborhood: " + d.neighborhood
                );
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });

    entered.merge(dots)
        .attr("fill", function(d) {
            var key = mapColorBy === "days_to_close" ? d.days_to_close : (d[mapColorBy] || "Unknown");
            if (key == null || isNaN(key)) return "#777";
            return colorScale(key);
        })
        .attr("cx", function(d) {
            return leafletMap.latLngToContainerPoint([d.latitude, d.longitude]).x;
        })
        .attr("cy", function(d) {
            return leafletMap.latLngToContainerPoint([d.latitude, d.longitude]).y;
        });

    drawMapLegend(colorInfo);
}

function drawMapLegend(colorInfo) { // The legend at the bottom of the map gets it's own function because the color of the map depends on the days between open and close 
    var legend = d3.select("#mapLegend");
    legend.selectAll("*").remove();

    if (colorInfo.kind === "numbers") {
        var bins = 6;
        var domain = colorInfo.domain;
        for (var i = 0; i < bins; i += 1) {
            var t = i / (bins - 1);
            var value = domain[0] + t * (domain[1] - domain[0]);
            var item = legend.append("span").attr("class", "legend-item");
            item.append("span")
                .attr("class", "legend-swatch")
                .style("background", colorInfo.scale(value));
            item.append("span").text(d3.format(".0f")(value) + (colorInfo.labelSuffix || " days"));
        }
        return;
    }

    colorInfo.categories.slice(0, 14).forEach(function(category) {
        var item = legend.append("span").attr("class", "legend-item");
        item.append("span")
            .attr("class", "legend-swatch")
            .style("background", colorInfo.scale(category));
        item.append("span").text(category);
    });
}

function syncAnimationControls() {
    var slider = document.getElementById("timeAnimationSlider");
    var label = document.getElementById("timeAnimationLabel");
    if (!slider || !label || !minCreatedDate || !maxCreatedDate) return;
    var totalDays = Math.max(1, d3.timeDay.count(minCreatedDate, maxCreatedDate));

    slider.max = String(totalDays);
    if (!animationCutoffDate) {
        slider.value = String(totalDays);
        label.textContent = "Showing full year";
    } else {
        var offset = d3.timeDay.count(minCreatedDate, animationCutoffDate);
        slider.value = String(Math.max(0, Math.min(totalDays, offset)));
        label.textContent = "Showing through " + d3.timeFormat("%b %d, %Y")(animationCutoffDate);
    }
}

function startAnimation() {
    if (!minCreatedDate || !maxCreatedDate) return;
    stopAnimation();
    var current = minCreatedDate;
    animationCutoffDate = current;
    syncAnimationControls();
    refreshLinkedCharts();
    animationTimer = setInterval(function() {
        current = d3.timeDay.offset(current, 7);
        if (current > maxCreatedDate) {
            stopAnimation();
            return;
        }
        animationCutoffDate = current;
        syncAnimationControls();
        refreshLinkedCharts();
    }, 140);
}

function stopAnimation() {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }
}

function setupMapControls() {
    d3.select("#serviceFocusSelect").on("change", function() {
        setServiceFocus(this.value);
    });

    d3.select("#mapColorBySelect").on("change", function() {
        setMapColorByField(this.value);
    });

    d3.select("#basemapSelect").on("change", function() {
        var next = tileLayers[this.value];
        if (!next || next === activeTileLayer) return;
        leafletMap.removeLayer(activeTileLayer);
        activeTileLayer = next.addTo(leafletMap);
    });

    d3.select("#mapRenderModeSelect").on("change", function() {
        setMapRenderMode(this.value);
    });

    d3.select("#playTimeBtn").on("click", function() {
        startAnimation();
    });

    d3.select("#stopTimeBtn").on("click", function() {
        stopAnimation();
        animationCutoffDate = null;
        syncAnimationControls();
        refreshLinkedCharts();
    });

    d3.select("#timeAnimationSlider").on("input", function() {
        stopAnimation();
        var days = +this.value;
        var date = d3.timeDay.offset(minCreatedDate, days);
        if (date >= maxCreatedDate) animationCutoffDate = null;
        else animationCutoffDate = date;
        syncAnimationControls();
        refreshLinkedCharts();
    });

    d3.select("#clearFiltersBtn").on("click", function() {
        resetAllFilters();
    });
}

// Making the functions available to level 2 / 3 
window.filterlistener = filterlistener;
window.refreshLinkedCharts = refreshLinkedCharts;
window.getFilteredRows = getFilteredRows;
window.setTimeBrushRange = setTimeBrushRange;
window.setMapBrushIds = setMapBrushIds;
window.toggleBarCategory = toggleBarCategory;
window.getBarCategorySet = getBarCategorySet;
window.resetAllFilters = resetAllFilters;
window.setMapColorByField = setMapColorByField;

d3.csv(L1_DATA_PATH, convertCsvRow).then(function(rows) {
    l1Data = rows.filter(function(d) {
        return d.date_created != null && d.date_created.getFullYear() === 2025;
    });

    minCreatedDate = d3.min(l1Data, function(d) { return d.date_created; });
    maxCreatedDate = d3.max(l1Data, function(d) { return d.date_created; });

    setupLeafletMap();
    setupMapControls();
    syncAnimationControls();
    refreshLinkedCharts();
});

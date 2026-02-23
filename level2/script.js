// Cursor was used to help me with code snippets and debugging.
// I was having trouble with the map populating so I used the cursor to help me.
Promise.all([
    d3.csv("../data/countries_health_wealth_single_year.csv"),
    d3.json("../data/world.geojson")
]).then(function([data, geojson]) {
    data.forEach(d => {
        d.gdp = +d.gdp;
        d.life_expectancy = +d.life_expectancy;
    });
    geoData = geojson;
    csvData = data;
    dataByCode = {};
    data.forEach(d => { dataByCode[d.code] = d; });

    createChoropleth("gdp");
    setupMapToggle();
});

function createChoropleth(attribute) {
    const container = d3.select("#choropleth");
    container.selectAll("*").remove();

    const padding = 48;
    const width = 880;
    const height = 480;

    const projection = d3.geoMercator()
        .fitExtent([[padding, padding], [width - padding, height - padding]], geoData);
    const pathGenerator = d3.geoPath().projection(projection);

    const values = csvData.map(d => d[attribute]).filter(v => v != null && !isNaN(v));
    const domain = [d3.min(values), d3.max(values)];

    const colorScale = attribute === "gdp"
        ? d3.scaleSequential(d3.interpolateBlues).domain(domain)
        : d3.scaleSequential(d3.interpolateGreens).domain(domain);

    const legendH = 44;
    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height + legendH)
        .attr("viewBox", `0 0 ${width} ${height + legendH}`);

    const mapLayer = svg.append("g").attr("class", "map-layer");

    mapLayer.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#eef1f4")
        .attr("rx", 4);

    
    mapLayer.selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", pathGenerator)
        .attr("fill", d => {
            const id = d.id;
            const row = id ? dataByCode[id] : null;
            const v = row ? row[attribute] : null;
            if (v == null || isNaN(v)) return "#dde2e8";
            return colorScale(v);
        })
        .attr("stroke", "#b0b8c4")
        .attr("stroke-width", 0.8);

    // Legend 
    const legendWidth = 260;
    const legendHeight = 14;
    const legendX = (width - legendWidth) / 2;
    const legendY = height + 12;

    const defs = svg.append("defs");
    const grad = defs.append("linearGradient")
        .attr("id", "legend-gradient-" + attribute)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");
    d3.range(6).forEach(i => {
        const t = i / 5;
        grad.append("stop")
            .attr("offset", t)
            .attr("stop-color", colorScale(domain[0] + t * (domain[1] - domain[0])));
    });

    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("fill", "url(#legend-gradient-" + attribute + ")")
        .attr("stroke", "#8b95a4")
        .attr("stroke-width", 1)
        .attr("rx", 2);

    const legendScale = d3.scaleLinear().domain(domain).range([0, legendWidth]);
    const format = attribute === "gdp"
        ? d3.format(",.0f")
        : d3.format(".1f");
    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickSize(6)
        .tickFormat(format);

    const axisG = svg.append("g")
        .attr("transform", `translate(${legendX},${legendY + legendHeight})`)
        .call(legendAxis);
    axisG.selectAll(".tick line").attr("stroke", "#8b95a4");
    axisG.selectAll(".domain").attr("stroke", "#8b95a4");
    axisG.selectAll("text").attr("fill", "#5a6573").attr("font-size", "11px");

    // Label
    const label = attribute === "gdp" ? "GDP per Capita (USD)" : "Life Expectancy (years)";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", legendY - 6)
        .attr("text-anchor", "middle")
        .attr("fill", "#4a5568")
        .style("font-size", "12px")
        .style("font-weight", "500")
        .text(label);
}

function setupMapToggle() {
    d3.selectAll(".toggle-btn").on("click", function() {
        const btn = d3.select(this);
        const attr = btn.attr("data-attr");
        d3.selectAll(".toggle-btn").classed("active", false);
        btn.classed("active", true);
        createChoropleth(attr);
    });
}


// shared selection state so other graphs can update
window.brushedCodes = null;

var l1Data; 

var tooltip = d3.select("body").append("div").attr("class", "viz-tooltip");

d3.csv("../data/countries_health_wealth_single_year.csv").then(function(data) {

    data.forEach(d => {
        d.gdp = +d.gdp;
        d.life_expectancy = +d.life_expectancy;
    });

    l1Data = data;

    createGDPHistogram(data);
    createLifeHistogram(data);
    createScatterplot(data);
});




function createGDPHistogram(data) {
    const margin = {top: 20, right: 30, bottom: 40, left: 40},
          width = 650 - margin.left - margin.right,
          height = 350 - margin.top - margin.bottom;

    const svg = d3.select("#gdpHistogram")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.gdp))
        .range([0, width]);

    const histogram = d3.histogram()
        .value(d => d.gdp)
        .domain(x.domain())
        .thresholds(x.ticks(20));
    const bins = histogram(data);

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .range([height, 0]);

    svg.append("g")
        .attr("class", "gdp-bars")
        .selectAll("rect")
        .data(bins) 
        .enter()
        .append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => height - y(d.length))
        .attr("fill", "#00d4aa")
        .attr("rx", 2)
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1)
                .html(`<strong>$${d3.format(",.0f")(d.x0)} – $${d3.format(",.0f")(d.x1)}</strong><br>${d.length} countries`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });

    svg.append("g") /* X axis */
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))

    svg.append("g") /*Y Axis*/
        .call(d3.axisLeft(y))

    // brush
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("brush end", function(event) {
            gdpBrushed(event, x);
        });

    svg.append("g").attr("class", "brush").call(brush);

    // Titles and labels
    const textFill = "#e6edf3";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("fill", textFill)
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .text("Distribution of GDP per Capita (2023)");


    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text("GDP per Capita (USD)");


    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -25)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text("Number of Countries");
}   




function createLifeHistogram (data) {

    const margin = {top: 20, right: 30, bottom: 40, left: 40},
          width = 500 - margin.left - margin.right,
          height = 350 - margin.top - margin.bottom;

    const svg = d3.select("#lifeExpectancyHistogram")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.life_expectancy))
        .nice()
        .range([0, width]);

    const histogram = d3.histogram()
        .value(d => d.life_expectancy)
        .domain(x.domain())
        .thresholds(x.ticks(20));

    const bins = histogram(data);

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .nice()
        .range([height, 0]);

    svg.append("g")
        .attr("class", "life-bars")
        .selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => height - y(d.length))
        .attr("fill", "#7c3aed")
    .attr("rx", 2)
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1)
                .html(`<strong>${d3.format(".1f")(d.x0)} – ${d3.format(".1f")(d.x1)} yrs</strong><br>${d.length} countries`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))

    svg.append("g")
        .call(d3.axisLeft(y))

    // brush
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("brush end", function(event) {
            lifeBrushed(event, x);
        });

    svg.append("g").attr("class", "brush").call(brush);

    // Labels and Title
    const textFill = "#e6edf3";
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("fill", textFill)
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .text("Distribution of Life Expectancy (2023)");

        
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text("Life Expectancy (Years)");
        
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text("Number of Countries");
}



function createScatterplot(data) {
    const margin = { top: 20, right: 30, bottom: 50, left: 55 },
        width = 700 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#scatterplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.gdp))
        .nice()
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.life_expectancy))
        .nice()
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))

    svg.append("g")
        .call(d3.axisLeft(y))

    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.gdp))
        .attr("cy", d => y(d.life_expectancy))
        .attr("r", 4)
        .attr("fill", "#00d4aa")
        .attr("opacity", 0.8)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 7).attr("opacity", 1);
            tooltip.style("opacity", 1)
                .html(`<strong>${d.country_x}</strong><br>GDP: $${d3.format(",.0f")(d.gdp)}<br>Life Exp: ${d3.format(".1f")(d.life_expectancy)} yrs`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 4).attr("opacity", 0.8);
            tooltip.style("opacity", 0);
        });

    // scatterplot brush (2D)
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("brush end", function(event) {
            scatterBrushed(event, x, y);
        });

    svg.append("g").attr("class", "brush").call(brush);

    const textFill = "#e6edf3";
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("fill", textFill)
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .text("GDP per Capita vs Life Expectancy (2023)");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text("GDP per Capita (USD)");
   
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text("Life Expectancy (Years)");
}


// ---- Brush state tracking ----
// store the active range for each brush so we can combine them
var gdpRange = null;
var lifeRange = null;
var scatterRange = null;

function gdpBrushed(event, xScale) {   // GDP Histogram brush
    if (!event.selection) {
        gdpRange = null;
    } else {
        gdpRange = event.selection.map(xScale.invert);
    }
    applyBrushSelection();
} 

function lifeBrushed(event, xScale) { // Life Histogram brush
    if (!event.selection) {
        lifeRange = null;
    } else {
        lifeRange = event.selection.map(xScale.invert);
    }
    applyBrushSelection();
} 

function scatterBrushed(event, xScale, yScale) {// Scatterplot brush
    if (!event.selection) { 
        scatterRange = null;
    } else {
        const [[x0, y0], [x1, y1]] = event.selection;
        scatterRange = {
            gdp: [xScale.invert(x0), xScale.invert(x1)],
            life: [yScale.invert(y1), yScale.invert(y0)]
        };
    }
    applyBrushSelection();
} 

function applyBrushSelection() {
    if (!l1Data) return;

    // No brush making it default state
    if (!gdpRange && !lifeRange && !scatterRange) {
        window.brushedCodes = null;
        highlightScatter(null);
        highlightHistoBars(null);
        if (window.highlightChoropleth) window.highlightChoropleth(null);
        return;
    }

    // filter data through all active brushes (intersection)
    var selected = l1Data.filter(d => {
        if (gdpRange && (d.gdp < gdpRange[0] || d.gdp > gdpRange[1])) return false;
        if (lifeRange && (d.life_expectancy < lifeRange[0] || d.life_expectancy > lifeRange[1])) return false;
        if (scatterRange) {
            if (d.gdp < scatterRange.gdp[0] || d.gdp > scatterRange.gdp[1]) return false;
            if (d.life_expectancy < scatterRange.life[0] || d.life_expectancy > scatterRange.life[1]) return false;
        }
        return true;
    });

    var codes = new Set(selected.map(d => d.code));
    window.brushedCodes = codes;

    highlightScatter(codes);
    highlightHistoBars(codes);
    if (window.highlightChoropleth) window.highlightChoropleth(codes);
}

function highlightScatter(codes) {
    d3.select("#scatterplot").selectAll("circle")
        .attr("opacity", d => {
            if (!codes) return 0.8;
            return codes.has(d.code) ? 0.9 : 0.1;
        })
        .attr("r", d => {
            if (!codes) return 4;
            return codes.has(d.code) ? 5 : 3;
        });
}

function highlightHistoBars(codes) {
    if (!codes) {
        d3.select("#gdpHistogram").selectAll(".gdp-bars rect").attr("opacity", 1);
        d3.select("#lifeExpectancyHistogram").selectAll(".life-bars rect").attr("opacity", 1);
        return;
    }

    d3.select("#gdpHistogram").selectAll(".gdp-bars rect")
        .attr("opacity", d => {
            var hasSelected = d.some(item => codes.has(item.code));
            return hasSelected ? 1 : 0.2;
        });
    d3.select("#lifeExpectancyHistogram").selectAll(".life-bars rect")
        .attr("opacity", d => {
            var hasSelected = d.some(item => codes.has(item.code));
            return hasSelected ? 1 : 0.2;
        });
}

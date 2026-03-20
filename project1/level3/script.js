const L3_DATA_PATH = "../data/countries_health_wealth_clean.csv";
const POP_PATH = "../data/population.csv";

var l3Tooltip = d3.select("body").append("div").attr("class", "viz-tooltip");

Promise.all([d3.csv(L3_DATA_PATH), d3.csv(POP_PATH)]).then(function([raw, popRaw]) {
    const popByKey = new Map(popRaw.map(d => [`${d.Code}-${+d.Year}`, +d.Population]));

    const data = raw.map(d => {
        const year = +d.year;
        const code = d.code;
        const pop = popByKey.get(`${code}-${year}`);
        return {
            country: d.country_x,
            code,
            year,
            gdp: +d.gdp,
            life_expectancy: +d.life_expectancy,
            population: pop == null || isNaN(pop) ? null : pop
        };
    });

    const countries = Array.from(new Set(data.map(d => d.country))).sort(d3.ascending);
    const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);

    const countrySelect = d3.select("#countrySelect");
    const yearSelect = d3.select("#yearSelect");

    // Add attribute selector dynamically (no HTML/CSS changes needed)
    const controlRow = d3.select(".l3-controls");
    const attrGroup = controlRow.append("div").attr("class", "control-group");
    attrGroup.append("label").attr("for", "attrSelect").text("Attribute");
    const attrSelect = attrGroup.append("select").attr("id", "attrSelect");

    const attrOptions = [
        { key: "life_expectancy", label: "Life Expectancy" },
        { key: "gdp", label: "GDP per Capita" },
        { key: "population", label: "Population" }
    ];
    attrSelect
        .selectAll("option")
        .data(attrOptions)
        .enter()
        .append("option")
        .attr("value", d => d.key)
        .text(d => d.label);

    countrySelect
        .selectAll("option")
        .data(countries)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    yearSelect
        .selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    const defaultCountry = countries.includes("Canada") ? "Canada" : countries[0];
    const defaultYear = d3.max(years);
    const defaultAttr = "life_expectancy";

    countrySelect.property("value", defaultCountry);
    yearSelect.property("value", defaultYear);
    attrSelect.property("value", defaultAttr);

    function refresh() {
        const c = countrySelect.property("value");
        const y = +yearSelect.property("value");
        const a = attrSelect.property("value");
        updateTrendChart(data, c, y, a);
        updateYearScatter(data, y, c, a);
    }

    refresh();

    countrySelect.on("change", refresh);
    yearSelect.on("change", refresh);
    attrSelect.on("change", refresh);
});

function updateTrendChart(data, country, selectedYear, attribute) {
    const container = d3.select("#trendChart");
    container.selectAll("*").remove();

    const filtered = data.filter(d => d.country === country && d[attribute] != null);
    if (!filtered.length) {
        container.append("p").text("No data for selected country.");
        return;
    }

    const margin = { top: 44, right: 26, bottom: 32, left: 62 },
          width = 640 - margin.left - margin.right,
          height = 260 - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const textFill = "#e6edf3";
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("fill", textFill)
        .style("font-size", "14px")
        .style("font-weight", "600")
        .text(`${prettyLabel(attribute)} over Time — ${country}`);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(filtered, d => d.year))
        .nice()
        .range([0, width]);

    const valExtent = d3.extent(filtered, d => d[attribute]);
    const y = d3.scaleLinear()
        .domain(attribute === "life_expectancy" ? valExtent : [0, valExtent[1]]).nice()
        .range([height, 0]);

    g.append("g") /* X axis */
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));

    g.append("g") /* Y axis */
        .call(d3.axisLeft(y).ticks(5).tickFormat(formatFor(attribute)));

    const line = d3.line()
        .defined(d => d[attribute] != null)
        .x(d => x(d.year))
        .y(d => y(d[attribute]));

    g.append("path")
        .datum(filtered)
        .attr("fill", "none")
        .attr("stroke", colorFor(attribute))
        .attr("stroke-width", 2.8)
        .attr("d", line);

    // invisible hover circles on each data point for tooltips
    g.selectAll(".hover-dot")
        .data(filtered)
        .enter()
        .append("circle")
        .attr("class", "hover-dot")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d[attribute]))
        .attr("r", 12)
        .attr("fill", "transparent")
        .on("mouseover", function(event, d) {
            const fmt = formatFor(attribute);
            l3Tooltip.style("opacity", 1)
                .html(`<strong>${d.year}</strong><br>${prettyLabel(attribute)}: ${fmt(d[attribute])}`);
        })
        .on("mousemove", function(event) {
            l3Tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() { l3Tooltip.style("opacity", 0); });

    // y label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margin.top + height / 2))
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text(prettyLabel(attribute));

    // marker for selected year
    const yearPoint = filtered.find(d => d.year === selectedYear);
    if (yearPoint != null) {
        const xYear = x(selectedYear);
        g.append("line")
            .attr("x1", xYear)
            .attr("x2", xYear)
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#f59e0b")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "4,4")
            .attr("opacity", 0.8);

        g.append("circle")
            .attr("cx", xYear)
            .attr("cy", y(yearPoint[attribute]))
            .attr("r", 5)
            .attr("fill", colorFor(attribute))
            .attr("stroke", "#0d1117")
            .attr("stroke-width", 2);
    }
}

function updateYearScatter(data, year, selectedCountry, attribute) {
    const container = d3.select("#yearScatter");
    container.selectAll("*").remove();

    let yAttr = attribute;
    if (yAttr === "gdp") yAttr = "life_expectancy";

    const filtered = data.filter(d => d.year === year && d.gdp != null && d[yAttr] != null);
    if (!filtered.length) {
        container.append("p").text("No data for selected year.");
        return;
    }

    const margin = { top: 28, right: 24, bottom: 40, left: 52 },
          width = 640 - margin.left - margin.right,
          height = 260 - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const textFill = "#e6edf3";
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("fill", textFill)
        .style("font-size", "14px")
        .style("font-weight", "600")
        .text(`GDP vs ${prettyLabel(yAttr)} — ${year}`);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(filtered, d => d.gdp))
        .nice()
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain(d3.extent(filtered, d => d[yAttr]))
        .nice()
        .range([height, 0]);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("$,.0f")));

    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(formatFor(yAttr)));

    g.selectAll("circle")
        .data(filtered)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.gdp))
        .attr("cy", d => y(d[yAttr]))
        .attr("r", d => d.country === selectedCountry ? 5 : 3)
        .attr("fill", d => d.country === selectedCountry ? "#f59e0b" : "#00d4aa")
        .attr("opacity", d => d.country === selectedCountry ? 0.9 : 0.7)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 7).attr("opacity", 1);
            l3Tooltip.style("opacity", 1)
                .html(`<strong>${d.country}</strong><br>GDP: ${formatFor("gdp")(d.gdp)}<br>${prettyLabel(yAttr)}: ${formatFor(yAttr)(d[yAttr])}`);
        })
        .on("mousemove", function(event) {
            l3Tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .attr("r", d.country === selectedCountry ? 5 : 3)
                .attr("opacity", d.country === selectedCountry ? 0.9 : 0.7);
            l3Tooltip.style("opacity", 0);
        });

    // Axis labels
    svg.append("text")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", height + margin.top + margin.bottom - 4)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text("GDP per Capita (USD)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margin.top + height / 2))
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .style("font-size", "13px")
        .text(prettyLabel(yAttr));
}

function prettyLabel(attr) {
    if (attr === "gdp") return "GDP per Capita (USD)";
    if (attr === "life_expectancy") return "Life Expectancy (years)";
    if (attr === "population") return "Population";
    return attr;
}

function formatFor(attr) {
    if (attr === "gdp") return d3.format("$,.0f");
    if (attr === "life_expectancy") return d3.format(".1f");
    if (attr === "population") return d3.format(".2s");
    return d => d;
}

function colorFor(attr) {
    if (attr === "gdp") return "#00d4aa";
    if (attr === "life_expectancy") return "#a78bfa";
    if (attr === "population") return "#f59e0b";
    return "#e6edf3";
}

// Level 3: Use year and country to explore trends over time.
// Data: ../data/countries_health_wealth_clean.csv

const DATA_PATH_L3 = "../data/countries_health_wealth_clean.csv";

d3.csv(DATA_PATH_L3).then(function(raw) {
    const data = raw.map(d => ({
        country: d.country_x,
        code: d.code,
        year: +d.year,
        gdp: +d.gdp,
        life_expectancy: +d.life_expectancy
    }));

    const countries = Array.from(new Set(data.map(d => d.country))).sort(d3.ascending);
    const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);

    const countrySelect = d3.select("#countrySelect");
    const yearSelect = d3.select("#yearSelect");

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

    countrySelect.property("value", defaultCountry);
    yearSelect.property("value", defaultYear);

    updateTrendChart(data, defaultCountry, defaultYear);
    updateYearScatter(data, defaultYear, defaultCountry);

    function refresh() {
        const c = countrySelect.property("value");
        const y = +yearSelect.property("value");
        updateTrendChart(data, c, y);
        updateYearScatter(data, y, c);
    }

    countrySelect.on("change", refresh);
    yearSelect.on("change", refresh);
});

function updateTrendChart(data, country, selectedYear) {
    const container = d3.select("#trendChart");
    container.selectAll("*").remove();

    const filtered = data.filter(d => d.country === country);
    if (!filtered.length) {
        container.append("p").text("No data for selected country.");
        return;
    }

    const margin = { top: 44, right: 40, bottom: 32, left: 52 };
    const width = 640 - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#2c3e50")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .text(`GDP & Life Expectancy over Time — ${country}`);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(filtered, d => d.year))
        .nice()
        .range([0, width]);

    const gdpExtent = d3.extent(filtered, d => d.gdp);
    const lifeExtent = d3.extent(filtered, d => d.life_expectancy);

    const yLeft = d3.scaleLinear()
        .domain([0, gdpExtent[1]]).nice()
        .range([height, 0]);

    const yRight = d3.scaleLinear()
        .domain(lifeExtent).nice()
        .range([height, 0]);

    const xAxis = d3.axisBottom(x).ticks(6).tickFormat(d3.format("d"));
    const yAxisLeft = d3.axisLeft(yLeft).ticks(5);
    const yAxisRight = d3.axisRight(yRight).ticks(5);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    g.append("g").call(yAxisLeft);

    g.append("g")
        .attr("transform", `translate(${width},0)`)
        .call(yAxisRight);

    const gdpLine = d3.line()
        .x(d => x(d.year))
        .y(d => yLeft(d.gdp));

    const lifeLine = d3.line()
        .x(d => x(d.year))
        .y(d => yRight(d.life_expectancy));

    g.append("path")
        .datum(filtered)
        .attr("fill", "none")
        .attr("stroke", "#4a7ba7")
        .attr("stroke-width", 2.5)
        .attr("d", gdpLine);

    g.append("path")
        .datum(filtered)
        .attr("fill", "none")
        .attr("stroke", "#3d7a5f")
        .attr("stroke-width", 2.5)
        .attr("d", lifeLine);

    /* Year marker: vertical line at selected year */
    const yearPoint = filtered.find(d => d.year === selectedYear);
    if (yearPoint != null) {
        const xYear = x(selectedYear);
        g.append("line")
            .attr("x1", xYear)
            .attr("x2", xYear)
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#8b7355")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "4,4")
            .attr("opacity", 0.8);

        g.append("circle")
            .attr("cx", xYear)
            .attr("cy", yLeft(yearPoint.gdp))
            .attr("r", 5)
            .attr("fill", "#4a7ba7")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);

        g.append("circle")
            .attr("cx", xYear)
            .attr("cy", yRight(yearPoint.life_expectancy))
            .attr("r", 5)
            .attr("fill", "#3d7a5f")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
    }

}

function updateYearScatter(data, year, selectedCountry) {
    const container = d3.select("#yearScatter");
    container.selectAll("*").remove();

    const filtered = data.filter(d => d.year === year);
    if (!filtered.length) {
        container.append("p").text("No data for selected year.");
        return;
    }

    const margin = { top: 28, right: 24, bottom: 40, left: 48 };
    const width = 640 - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .text(`GDP vs Life Expectancy — ${year}`);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(filtered, d => d.gdp))
        .nice()
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain(d3.extent(filtered, d => d.life_expectancy))
        .nice()
        .range([height, 0]);

    const xAxis = d3.axisBottom(x).ticks(6);
    const yAxis = d3.axisLeft(y).ticks(5);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    g.append("g").call(yAxis);

    g.selectAll("circle")
        .data(filtered)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.gdp))
        .attr("cy", d => y(d.life_expectancy))
        .attr("r", d => d.country === selectedCountry ? 5 : 3)
        .attr("fill", d => d.country === selectedCountry ? "#e67e22" : "#4a7ba7")
        .attr("opacity", d => d.country === selectedCountry ? 0.9 : 0.7);

    svg.append("text")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", height + margin.top + margin.bottom - 4)
        .attr("text-anchor", "middle")
        .attr("fill", "#4a5568")
        .attr("font-size", 12)
        .text("GDP per Capita (USD)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margin.top + height / 2))
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#4a5568")
        .attr("font-size", 12)
        .text("Life Expectancy (years)");
}


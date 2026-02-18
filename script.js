d3.csv("data/countries_health_wealth_single_year.csv").then(function(data) {

    data.forEach(d => {
        d.gdp = +d.gdp;
        d.life_expectancy = +d.life_expectancy;
    });

    createGDPHistogram(data);
    createLifeHistogram(data);
   
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
        .nice()
        .range([0, width]);

    const histogram = d3.histogram()
        .value(d => d.gdp)
        .domain(x.domain())
        .thresholds(x.ticks(20));
    const bins = histogram(data);

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .nice()
        .range([height, 0]);

    svg.append("g")
        .selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => height - y(d.length))
        .attr("fill", "steelblue");

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Titles and labels
    svg.append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Distribution of GDP per Capita (2024)");

    svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("GDP per Capita (USD)");

    svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y",  -25)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
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
        .selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => height - y(d.length))
        .attr("fill", "seagreen");

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Labels and Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Distribution of Life Expectancy (2024)");


    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Life Expectancy (Years)");


    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Number of Countries");
}

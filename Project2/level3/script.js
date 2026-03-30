var attrConfig = [
    { key: "neighborhood", label: "Neighborhood", color: "#60a5fa", maxBars: 12 },
    { key: "method_received", label: "Method received", color: "#34d399", maxBars: 7 },
    { key: "dept_name", label: "Department", color: "#f59e0b", maxBars: 6 },
    { key: "priority", label: "Priority", color: "#f472b6", maxBars: 6 }
];

function createAttributeCharts() {
    var container = d3.select("#attributeCharts");
    container.selectAll("*").remove();

    var data = window.getFilteredRows({ ignore: ["attributes"], clipToMap: true });

    attrConfig.forEach(function(config) {
        createSingleAttributeChart(container, data, config);
    });
}

function createSingleAttributeChart(container, data, config) {
    var counts = d3.rollups(
        data,
        function(values) { return values.length; },
        function(d) { return d[config.key] || "Unknown"; }
    )
        .map(function(row) { return { category: row[0], count: row[1] }; })
        .sort(function(a, b) { return d3.descending(a.count, b.count); })
        .slice(0, config.maxBars);

    if (!counts.length) return;

    var card = container.append("div").attr("class", "attr-chart");
    var margin = { top: 24, right: 14, bottom: 16, left: 180 };
    var width = 560 - margin.left - margin.right;
    var height = counts.length * 20;

    var svg = card.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    svg.append("text")
        .attr("class", "attr-label")
        .attr("x", 8)
        .attr("y", 14)
        .text(config.label + " (click bars to filter)");

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleLinear()
        .domain([0, d3.max(counts, function(d) { return d.count; })])
        .nice()
        .range([0, width]);

    var y = d3.scaleBand()
        .domain(counts.map(function(d) { return d.category; }))
        .range([0, height])
        .padding(0.2);

    var selectedSet = window.getBarCategorySet(config.key);

    g.selectAll("rect")
        .data(counts)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", function(d) { return y(d.category); })
        .attr("width", function(d) { return x(d.count); })
        .attr("height", y.bandwidth())
        .attr("fill", function(d) {
            if (selectedSet.size === 0) return config.color;
            return selectedSet.has(d.category) ? config.color : "#2b3553";
        })
        .attr("cursor", "pointer")
        .on("click", function(event, d) {
            window.toggleBarCategory(config.key, d.category);
        })
        .on("mouseover", function(event, d) {
            d3.select("#tooltip")
                .style("opacity", 1)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 24) + "px")
                .html("<strong>" + d.category + "</strong><br>" + d.count + " requests");
        })
        .on("mousemove", function(event) {
            d3.select("#tooltip")
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 24) + "px");
        })
        .on("mouseout", function() {
            d3.select("#tooltip").style("opacity", 0);
        });

    g.selectAll(".bar-label")
        .data(counts)
        .enter()
        .append("text")
        .attr("x", function(d) { return x(d.count) + 6; })
        .attr("y", function(d) { return y(d.category) + y.bandwidth() / 2 + 4; })
        .attr("fill", "#dbeafe")
        .style("font-size", "11px")
        .text(function(d) { return d.count; });

    g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).tickSize(0));
}

window.filterlistener(createAttributeCharts);

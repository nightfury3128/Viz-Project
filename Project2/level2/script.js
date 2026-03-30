function createTimelineChart() {
    var container = d3.select("#timelineChart");
    container.selectAll("*").remove();

    var data = window.getFilteredRows({ ignore: ["timeline"], clipToMap: true });
    var dayKey = d3.timeFormat("%Y-%m-%d");
    var grouped = d3.rollups(
        data,
        function(values) {
            var count = values.length;
            var mapped = values.filter(function(v) {
                return v.latitude != null && v.longitude != null && !isNaN(v.latitude) && !isNaN(v.longitude);
            }).length;

            var unmapped = count - mapped;

            var neighCounts = d3.rollups(
                values,
                function(vv) { return vv.length; },
                function(d) { return d.neighborhood || "Unknown"; }
            ).sort(function(a, b) { return d3.descending(a[1], b[1]); });

            var typeCounts = d3.rollups(
                values,
                function(vv) { return vv.length; },
                function(d) { return d.sr_type_desc || d.sr_type || "Unknown"; }
            ).sort(function(a, b) { return d3.descending(a[1], b[1]); });

            var topNeighborhood = neighCounts.length ? neighCounts[0][0] : "Unknown";
            var topServiceType = typeCounts.length ? typeCounts[0][0] : "Unknown";

            var numericDays = values
                .map(function(v) { return v.days_to_close; })
                .filter(function(n) { return n != null && !isNaN(n); });
            var avgDaysToClose = numericDays.length ? d3.mean(numericDays) : null;

            var examples = values.slice(0, 3).map(function(v) {
                return (v.sr_number || "SR?") + " (" + (v.sr_type_desc || v.sr_type || "Unknown") + ")";
            }).join("<br>");

            return {
                count: count,
                mapped: mapped,
                unmapped: unmapped,
                topNeighborhood: topNeighborhood,
                topServiceType: topServiceType,
                avgDaysToClose: avgDaysToClose,
                examples: examples
            };
        },
        function(d) { return d3.timeDay(d.date_created); }
    ).map(function(d) {
        return {
            date: d[0],
            key: dayKey(d[0]),
            count: d[1].count,
            mapped: d[1].mapped,
            unmapped: d[1].unmapped,
            topNeighborhood: d[1].topNeighborhood,
            topServiceType: d[1].topServiceType,
            avgDaysToClose: d[1].avgDaysToClose,
            examples: d[1].examples
        };
    }).sort(function(a, b) { return d3.ascending(a.date, b.date); });

    if (!grouped.length) return;

    var margin = { top: 18, right: 16, bottom: 38, left: 42 };
    var width = 560 - margin.left - margin.right;
    var height = 250 - margin.top - margin.bottom;

    var svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleTime()
        .domain(d3.extent(grouped, function(d) { return d.date; }))
        .range([0, width]);

    var y = d3.scaleLinear()
        .domain([0, d3.max(grouped, function(d) { return d.count; })])
        .nice()
        .range([height, 0]);

    var area = d3.area()
        .x(function(d) { return x(d.date); })
        .y0(height)
        .y1(function(d) { return y(d.count); })
        .curve(d3.curveMonotoneX);

    var line = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.count); })
        .curve(d3.curveMonotoneX);

    g.append("path")
        .datum(grouped)
        .attr("fill", "rgba(34, 211, 238, 0.22)")
        .attr("d", area);

    g.append("path")
        .datum(grouped)
        .attr("fill", "none")
        .attr("stroke", "#22d3ee")
        .attr("stroke-width", 2.2)
        .attr("d", line);

    var pointHover = g.append("line")
        .attr("stroke", "#93c5fd")
        .attr("stroke-width", 1.1)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("opacity", 0);

    function updateTimelineTooltip(event, localX) {
        var xPos = localX;
        var date = x.invert(xPos);
        var bisect = d3.bisector(function(d) { return d.date; }).center;
        var idx = bisect(grouped, date);
        var row = grouped[Math.max(0, Math.min(grouped.length - 1, idx))];

        pointHover
            .attr("x1", x(row.date))
            .attr("x2", x(row.date))
            .attr("opacity", 0.8);

        var avgText = row.avgDaysToClose == null ? "n/a" : d3.format(".1f")(row.avgDaysToClose) + " days";
        d3.select("#tooltip")
            .style("opacity", 1)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 24) + "px")
            .html(
                "<strong>" + d3.timeFormat("%b %d, %Y")(row.date) + "</strong><br>" +
                row.count + " requests" + "<br>" +
                "Mapped: " + row.mapped + " | Missing GPS: " + row.unmapped + "<br>" +
                "Top neighborhood: " + row.topNeighborhood + "<br>" +
                "Top service type: " + row.topServiceType + "<br>" +
                "Avg days to close: " + avgText + "<br>" +
                "<span style='color:#93c5fd'>Examples</span><br>" +
                row.examples
            );
    }

    function hideTimelineTooltip() {
        pointHover.attr("opacity", 0);
        d3.select("#tooltip").style("opacity", 0);
    }

    // Hover layer (helps when brushing isn't intercepting the mouse events)
    g.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("mousemove", function(event) {
            var xPos = d3.pointer(event, this)[0];
            updateTimelineTooltip(event, xPos);
        })
        .on("mouseout", hideTimelineTooltip);

    g.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(6));

    g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5));

    var brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("brush end", function(event) {
            if (!event.selection) {
                window.setTimeBrushRange(null);
                return;
            }
            var selectedRange = event.selection.map(x.invert);
            window.setTimeBrushRange(selectedRange);
        });

    g.append("g")
        .attr("class", "brush")
        .call(brush);

    // Brush overlay can intercept hover; attach the same tooltip handler to the overlay too.
    // This keeps tooltip working even when the brush is present.
    g.select(".brush .overlay")
        .on("mousemove", function(event) {
            var xPos = d3.pointer(event, this)[0];
            updateTimelineTooltip(event, xPos);
        })
        .on("mouseout", hideTimelineTooltip);
}

window.filterlistener(createTimelineChart);
    
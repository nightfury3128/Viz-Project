## Project Title
**Cincinnati 311 Service Explorer (2025): Graffiti and Pothole Requests**

---

## Motivation
The main motiviation for this project will probably be the project deadline but one of the other, less procastinaty will probably be my new interest in photography since graffiti is something that adds life around the university campus so this project helps me track new graffiti that I can visit to click pictures of if it is close to my house. 

---

## Data
This project uses Cincinnati’s 311 (non-emergency) service request data for **2025** from the city data portal:

- Dataset portal: [Cincinnati 311 Non-Emergency Service Requests](https://data.cincinnati-oh.gov/efficient-service-delivery/Cincinnati-311-Non-Emergency-Service-Requests/gcej-gmiw/about_data)

For this application, data is filtered to 2025 and interactively constrained to **Graffiti**, **Potholes** and **combination of the two**. The data is just a simple CSV that filters all graffiti and potholes for the year of 2025. 
---

## Sketches and Design Planning

1. **Map panel** as the primary spatial view  
2. **Timeline** for temporal trends  
3. **Attribute charts** for categorical breakdowns  

---

## Visualization Components and Interactions

### 1) Global Controls
Users can control:
- **Service focus**: Graffiti / Potholes / Graffiti + Potholes  
- **Map color by**: days to close, neighborhood, priority, department, etc.  
- **Map render mode**: points vs heatmap  
- **Basemap**: streets / light / satellite  
- **Animation**: play/stop + timeline slider  
- **Clear all filters**

These controls affect all linked visualizations.

### 2) Map View (Leaflet + D3 overlay)
- Displays each request as a point using latitude/longitude.
- Hover tooltip shows request details (type, dates, department, priority, neighborhood).
- Right-drag brush selects map region and filters all other views.
- Heatmap mode aggregates requests spatially.
- A map status indicator reports `Mapped` vs `Missing GPS` record counts.

### 3) Requests Over the Year (Timeline)
- Daily aggregated request counts across the year.
- Hover tooltip provides date-specific details.
- Brush selection filters all other charts and the map.
- Supports interactive exploration of seasonal/temporal spikes.

### 4) Attribute Views (Bar Charts)
Dedicated charts show distributions for:
- Major service category
- Service type (top)
- Neighborhood
- Method received
- Department
- Priority

Clicking bars applies category filters that propagate across the map and timeline.

### 5) Linked Behavior
This is a coordinated, linked dashboard:
- Timeline brush ↔ map ↔ attribute charts
- Map brush ↔ timeline ↔ attribute charts
- Attribute clicks ↔ map ↔ timeline
- Animation and service-focus selections update all views

---

## What the Application Enables You to Discover
Using linked interactions, the application reveals patterns such as:

- **Spatial concentration:** Graffiti and pothole requests cluster in specific neighborhoods/corridors.
- **Temporal spikes:** Certain periods show surges in requests, visible in the timeline.
- **Operational patterns:** Department and method-received distributions differ between focus types.
- **Data completeness insight:** Not all records have valid coordinates; these remain visible in non-map charts.

This application helped me realise the number of graffiti all across campus and the speed with which potholes are fixed just in cincinnati, most of the potholes have a close date of less than 0 days which is amazing. 
---

## Process, Tools, and Code Structure

### Libraries / Technologies
- **D3.js** for charts, scales, brushing, tooltips, and data transforms
- **Leaflet** for map base layers and map interactions
- **HTML/CSS/JavaScript** (no frameworks)

### Code Organization
- `index.html`: layout + UI controls
- `style.css`: theme and layout styling
- `level1/script.js`: data loading, map rendering, global filter state, map brushing, animation
- `level2/script.js`: timeline chart + timeline brushing
- `level3/script.js`: attribute bar charts + category filtering

### How to run
- Serve the project locally (e.g., VS Code Live Server or any static server)
- Open the app in a browser and interact with the controls/charts

### Links
- Code repository: https://github.com/nightfury3128/Viz-Project.git
- Live deployment: https://viz-project-omega.vercel.app/

---

## Challenges and Future Work

### Challenges
- Managing linked filters across multiple views without inconsistent states
- Handling records with missing coordinates while keeping them in linked charts
- Balancing interaction layers (e.g., timeline brush vs tooltip hover)
- Designing a compact UI that remains readable as features increase

### Future Work
- Add something to improve loading times like lazy loading 
- Maybe introduce a caching machanism to allow for all the years to be visible clealy
- Add more points and work on improving the overall design 

---

## Use of AI and Collaboration

### Use of AI
I used AI as a development assistant for:
- Debugging interaction conflicts (e.g., tooltip + brush event handling)
- Refactoring linked filter logic
- Generating implementation alternatives and validating edge cases
- Getting a requirement list and making sure all requirement are met

All AI suggestions were manually reviewed, tested, and adapted to project requirements.

## Who Did What
(Use this section exactly for your team grading transparency.)

- **Nipun Chandra**: Prompted Chatgpt and Cursor (Auto mode) and looked at the code to make sure all the errors and working with the design process. 
- **Cursor**: implemented the entire project

### Demo Video
[![Watch the demo](https://img.youtube.com/vi/ajAwV72rKLk/hqdefault.jpg)](https://youtu.be/ajAwV72rKLk)
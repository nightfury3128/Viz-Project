import pandas as pd 

clean = pd.read_csv("countries_health_wealth_clean.csv")

single_year = clean[clean["year"] == 2023]

print("Single year dataset created.")
single_year.to_csv("countries_health_wealth_single_year.csv", index=False)
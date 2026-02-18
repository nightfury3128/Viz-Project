import pandas as pd

df = pd.read_csv("countries_health_wealth_single_year.csv")

print("Number of rows:", len(df))
print("Unique years:", df["year"].unique())

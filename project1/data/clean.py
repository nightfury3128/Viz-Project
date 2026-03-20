import pandas as pd


gdp = pd.read_csv("gdp-per-capita-worldbank.csv")
life = pd.read_csv("life-expectancy.csv")

gdp = gdp[["Entity", "Code", "Year", "GDP per capita"]]
life = life[["Entity", "Code", "Year", "Life expectancy"]]

gdp = gdp.rename(columns={
    "Entity": "country",
    "Code": "code",
    "Year": "year",
    "GDP per capita": "gdp"
})

life = life.rename(columns={
    "Entity": "country",
    "Code": "code",
    "Year": "year",
    "Life expectancy": "life_expectancy"
})

gdp = gdp[gdp["code"].notna()]
life = life[life["code"].notna()]

print("GDP columns:", gdp.columns)
print("Life columns:", life.columns)

merged = pd.merge(
    gdp,
    life,
    on=["code", "year"],
    how="inner"
)

merged = merged.dropna()

print("Rows after merge:", len(merged))
print("Unique years:", merged["year"].unique())

# Save
merged.to_csv("countries_health_wealth_clean.csv", index=False)

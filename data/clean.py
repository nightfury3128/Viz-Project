import pandas as pd


gdp = pd.read_csv("data/gdp-per-capita-worldbank.csv")
life = pd.read_csv("data/life-expectancy.csv")


gdp = gdp[["Entity", "Code", "Year", "GDP per capita"]]
life = life[["Entity", "Code", "Year", "Life expectancy"]]


gdp.columns = ["country", "code", "year", "gdp"]
life.columns = ["country", "code", "year", "life_expectancy"]


gdp = gdp[gdp["code"].notna()]
life = life[life["code"].notna()]


merged = pd.merge(
    gdp,
    life[["code", "life_expectancy"]],
    on="code",
    how="inner"
)

merged.to_csv("countries_health_wealth_clean.csv", index=False)

print("Clean dataset saved.")
print(merged.head())

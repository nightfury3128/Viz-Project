import pandas as pd


INPUT_FILE = "Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv"
SERVICE_KEYWORD = "GRAFFITI"

OUTPUT_CLEAN = "clean.csv"
OUTPUT_MAPPABLE = "Mappable.csv"
OUTPUT_TIMELINE = "Timeline.csv"
OUTPUT_ATTR_COUNTS = "attribute.csv"



df = pd.read_csv(INPUT_FILE, low_memory=False)

keep_cols = [
    "SR_NUMBER",
    "SR_TYPE",
    "SR_TYPE_DESC",
    "PRIORITY",
    "DEPT_NAME",
    "METHOD_RECEIVED",
    "NEIGHBORHOOD",
    "TIME_RECEIVED",
    "DATE_CREATED",
    "DATE_CLOSED",
    "PLANNED_COMPLETION_DAYS",
    "LATITUDE",
    "LONGITUDE",
]

df = df[keep_cols].copy()

df = df.rename(
    columns={
        "SR_NUMBER": "sr_number",
        "SR_TYPE": "sr_type",
        "SR_TYPE_DESC": "sr_type_desc",
        "PRIORITY": "priority",
        "DEPT_NAME": "dept_name",
        "METHOD_RECEIVED": "method_received",
        "NEIGHBORHOOD": "neighborhood",
        "TIME_RECEIVED": "time_received",
        "DATE_CREATED": "date_created",
        "DATE_CLOSED": "date_closed",
        "PLANNED_COMPLETION_DAYS": "planned_completion_days",
        "LATITUDE": "latitude",
        "LONGITUDE": "longitude",
    }
)

df["date_created"] = pd.to_datetime(df["date_created"], errors="coerce")
df["date_closed"] = pd.to_datetime(df["date_closed"], errors="coerce")

df = df[df["date_created"].dt.year == 2025].copy()

service_match = (
    df["sr_type"].fillna("").str.lower().str.contains(SERVICE_KEYWORD.lower())
    | df["sr_type_desc"].fillna("").str.lower().str.contains(SERVICE_KEYWORD.lower())
)
df = df[service_match].copy()

for col in ["priority", "dept_name", "method_received", "neighborhood"]:
    df[col] = df[col].fillna("Unknown").astype(str).str.strip()
    df[col] = df[col].replace("", "Unknown")

df["planned_completion_days"] = pd.to_numeric(df["planned_completion_days"], errors="coerce")
df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

df["days_to_close"] = (df["date_closed"] - df["date_created"]).dt.days
df["days_to_close"] = df["days_to_close"].where(df["days_to_close"] >= 0)

df["date_created_str"] = df["date_created"].dt.strftime("%Y-%m-%d")
df["date_closed_str"] = df["date_closed"].dt.strftime("%Y-%m-%d")

clean_df = df[
    [
        "sr_number",
        "sr_type",
        "sr_type_desc",
        "priority",
        "dept_name",
        "method_received",
        "neighborhood",
        "time_received",
        "date_created_str",
        "date_closed_str",
        "planned_completion_days",
        "days_to_close",
        "latitude",
        "longitude",
    ]
].copy()

clean_df = clean_df.rename(
    columns={
        "date_created_str": "date_created",
        "date_closed_str": "date_closed",
    }
)

mappable_df = clean_df[
    clean_df["latitude"].between(38.9, 39.4, inclusive="both")
    & clean_df["longitude"].between(-84.8, -84.2, inclusive="both")
].copy()

timeline_df = (
    clean_df.groupby("date_created", dropna=False)["sr_number"]
    .count()
    .reset_index(name="request_count")
    .sort_values("date_created")
)

attr_frames = []
for attr in ["neighborhood", "method_received", "dept_name", "priority"]:
    counts = (
        clean_df.groupby(attr, dropna=False)["sr_number"]
        .count()
        .reset_index(name="request_count")
        .sort_values("request_count", ascending=False)
    )
    counts = counts.rename(columns={attr: "category"})
    counts["attribute"] = attr
    attr_frames.append(counts[["attribute", "category", "request_count"]])

attr_counts_df = pd.concat(attr_frames, ignore_index=True)



clean_df.to_csv(OUTPUT_CLEAN, index=False)
mappable_df.to_csv(OUTPUT_MAPPABLE, index=False)
timeline_df.to_csv(OUTPUT_TIMELINE, index=False)
attr_counts_df.to_csv(OUTPUT_ATTR_COUNTS, index=False)

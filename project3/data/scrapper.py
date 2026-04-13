import os
import re
import time
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = "https://transcripts.foreverdreaming.org/"
FORUM_URL = "https://transcripts.foreverdreaming.org/viewforum.php?f=1255"
OUTPUT_DIR = "daredevil_txt"


def get_rendered_html(url: str, wait_selector: str | None = None, timeout_ms: int = 60000) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            )
        )

        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)

        # Give the site time to finish whatever JS challenge / delayed load it uses
        page.wait_for_timeout(4000)

        if wait_selector:
            try:
                page.wait_for_selector(wait_selector, timeout=timeout_ms)
            except PlaywrightTimeoutError:
                print(f"Warning: selector {wait_selector!r} not found on {url}")

        html = page.content()
        browser.close()
        return html


def get_soup(url: str, wait_selector: str | None = None) -> BeautifulSoup:
    html = get_rendered_html(url, wait_selector=wait_selector)
    return BeautifulSoup(html, "html.parser")


def extract_episode_links(forum_url: str) -> list[dict]:
    soup = get_soup(forum_url, wait_selector="a.topictitle")

    print("PAGE TITLE:", soup.title.get_text(strip=True) if soup.title else "NO TITLE")

    anchors = soup.select("a.topictitle")
    print("topictitle count:", len(anchors))

    episodes = []
    for a in anchors:
        title = a.get_text(" ", strip=True)
        href = a.get("href", "").strip()

        if not href:
            continue

        # Keep only real episode titles like 01x01 - Into the Ring
        if re.match(r"^\d{2}x\d{2}\s*-\s*", title):
            full_url = urljoin(BASE_URL, href)
            episodes.append({"title": title, "url": full_url})

    return episodes


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return f"{name}.txt"


def extract_transcript_text(topic_url: str) -> str:
    soup = get_soup(topic_url, wait_selector=".postbody .content, .content, .postbody")

    container = (
        soup.select_one(".postbody .content")
        or soup.select_one(".content")
        or soup.select_one(".postbody")
    )

    if container is None:
        raise ValueError(f"Could not find transcript content for {topic_url}")

    return container.get_text("\n", strip=True)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    episodes = extract_episode_links(FORUM_URL)
    print(f"Found {len(episodes)} episode pages")

    if not episodes:
        print("No episodes found.")
        return

    episodes.sort(key=lambda ep: ep["title"])

    for i, ep in enumerate(episodes, start=1):
        title = ep["title"]
        url = ep["url"]
        filepath = os.path.join(OUTPUT_DIR, sanitize_filename(title))

        print(f"[{i}/{len(episodes)}] Downloading {title}")

        try:
            text = extract_transcript_text(url)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"Saved: {filepath}")
            time.sleep(1.0)
        except Exception as e:
            print(f"Failed on {title}: {e}")

    print("Done.")


if __name__ == "__main__":
    main()
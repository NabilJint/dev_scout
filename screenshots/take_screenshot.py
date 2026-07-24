from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.goto('http://localhost:3000/tools/1')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)  # Wait for animations and rendering
    page.screenshot(path='/Users/MAC/Documents/dev-scout-ai/screenshots/implementation-v1.png', full_page=True)
    print("Screenshot saved to screenshots/implementation-v1.png")
    browser.close()

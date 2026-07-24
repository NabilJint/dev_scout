from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    # Go to homepage
    page.goto('http://localhost:3000/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path='screenshots/home-with-links.png', full_page=True)
    print(f"Homepage screenshot taken. URL: {page.url}")
    
    # Click first tool card
    first_card = page.locator('a[href^="/tools/"]').first
    if first_card.count() > 0:
        print(f"Found link: {first_card.get_attribute('href')}")
        first_card.click()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(2000)
        page.screenshot(path='screenshots/details-after-click.png', full_page=True)
        print(f"Details page screenshot taken. URL: {page.url}")
    else:
        print("No tool links found!")
    
    browser.close()

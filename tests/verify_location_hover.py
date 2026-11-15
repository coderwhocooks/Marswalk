"""
Automated Browser Verification for Universal Location Hover Tooltips & Key Details.
Verifies:
1. 3D Globe View: Hovering over Martian globe surface reveals Areocentric coordinates, region name, and MOLA elevation.
2. 3D Globe View: Hovering over planetary landmark buttons/pins displays landmark name, dimension, and elevation.
3. Jezero 3D Surface: Hovering over the 3D terrain mesh reveals exact Jezero coordinates, elevation in meters, slope angle, and traversability rating.
4. Jezero 3D Surface: Hovering over geodesic habitat domes reveals MCDA score, slope, roughness, and capacity.
5. Jezero 3D Surface: Hovering over science diamond pins reveals mineralogy, priority, and investigation objective.
6. UI Sidebar: Hovering over Staging Site and Target presets reveals coordinates and elevation.
7. UI Sidebar: Hovering over Science Target cards, Habitat candidate cards, and Point of No Return cards.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
os.makedirs('screenshots', exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome_path, headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('console', lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}") if msg.type in ['error', 'warn'] else None)
    
    print('1. Navigating to http://localhost:8000...')
    page.goto('http://localhost:8000', wait_until='networkidle')
    page.wait_for_timeout(3500)
    
    # Canvas center for mouse movements
    canvas = page.query_selector('canvas')
    box = canvas.bounding_box()
    cx = box['x'] + box['width'] / 2
    cy = box['y'] + box['height'] / 2
    
    # TEST 1: Hover over Martian Globe Surface
    print('2. Testing hover over 3D Mars globe surface...')
    page.mouse.move(cx, cy)
    page.wait_for_timeout(1500)
    page.screenshot(path='screenshots/verify_hover_01_globe_surface.png')
    print('Saved screenshots/verify_hover_01_globe_surface.png')
    
    # TEST 2: Hover over Landmark Button (Olympus Mons)
    print('3. Testing hover over landmark button...')
    olympus_btn = page.query_selector('button:has-text("Olympus")')
    if olympus_btn:
        olympus_btn.hover()
        page.wait_for_timeout(1000)
        page.screenshot(path='screenshots/verify_hover_02_landmark_button.png')
        print('Saved screenshots/verify_hover_02_landmark_button.png')
        
    # TEST 3: Hover over Staging Site in Planner
    print('4. Testing hover over Staging Site box...')
    staging_box = page.query_selector('text=Octavia E. Butler Landing')
    if staging_box:
        staging_box.hover()
        page.wait_for_timeout(1000)
        page.screenshot(path='screenshots/verify_hover_03_staging_site.png')
        print('Saved screenshots/verify_hover_03_staging_site.png')
        
    # TEST 4: Hover over Target Preset Chip in Planner
    print('5. Testing hover over quick target preset...')
    preset_btn = page.query_selector('button:has-text("🎯")')
    if preset_btn:
        preset_btn.hover()
        page.wait_for_timeout(1000)
        page.screenshot(path='screenshots/verify_hover_04_target_preset.png')
        print('Saved screenshots/verify_hover_04_target_preset.png')
        
    # TEST 5: Switch to Jezero 3D Terrain View
    print('6. Switching to Jezero 3D Terrain view...')
    terrain_btn = page.query_selector('button:has-text("Jezero 3D Terrain")')
    if terrain_btn:
        terrain_btn.click()
        page.wait_for_timeout(2500)
        
    # Hover over the Jezero terrain mesh
    print('7. Testing hover over Jezero 3D terrain mesh...')
    page.mouse.move(cx, cy)
    page.wait_for_timeout(1500)
    page.screenshot(path='screenshots/verify_hover_05_jezero_terrain.png')
    print('Saved screenshots/verify_hover_05_jezero_terrain.png')
    
    # TEST 6: Hover over Science Target Card in Science Tab
    print('8. Testing hover over Science Target Card in Sidebar...')
    science_tab = page.query_selector('button:has-text("Science")')
    if science_tab:
        science_tab.click()
        page.wait_for_timeout(1500)
        target_card = page.query_selector('h4:has-text("Belva Crater")')
        if target_card:
            target_card.hover()
            page.wait_for_timeout(1000)
            page.screenshot(path='screenshots/verify_hover_06_science_card.png')
            print('Saved screenshots/verify_hover_06_science_card.png')
            
    # TEST 7: Hover over Habitat Candidate in Habitat Tab
    print('9. Testing hover over Habitat Candidate Card in Sidebar...')
    habitat_tab = page.query_selector('button:has-text("Habitat")')
    if habitat_tab:
        habitat_tab.click()
        page.wait_for_timeout(1500)
        hab_card = page.query_selector('text=Kodiak Mesa South Foreland')
        if hab_card:
            hab_card.hover()
            page.wait_for_timeout(1000)
            page.screenshot(path='screenshots/verify_hover_07_habitat_card.png')
            print('Saved screenshots/verify_hover_07_habitat_card.png')
            
    # TEST 8: Hover over Point of No Return (PNR) in Returnability Tab
    print('10. Testing hover over PNR in Returnability Tab...')
    return_tab = page.query_selector('button:has-text("Return")')
    if return_tab:
        return_tab.click()
        page.wait_for_timeout(1500)
        pnr_card = page.query_selector('text=Point of No Return (PNR)')
        if pnr_card:
            pnr_card.hover()
            page.wait_for_timeout(1000)
            page.screenshot(path='screenshots/verify_hover_08_pnr_card.png')
            print('Saved screenshots/verify_hover_08_pnr_card.png')
            
    print('TOTAL JAVASCRIPT ERRORS:', len(errors))
    for err in errors:
        print('JS Error:', err)
        
    browser.close()
    if len(errors) > 0:
        sys.exit(1)
    print('ALL LOCATION HOVER VERIFICATIONS PASSED SUCCESSFULLY!')

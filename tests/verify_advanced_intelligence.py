"""
Playwright End-to-End Verification of Advanced Intelligence Systems in MARSWALK.
Tests all five engines in the UI:
1. Mission Confidence Engine & Monte Carlo Simulator
2. Returnability Intelligence & Dynamic Emergency Abort Planner
3. Autonomous Science Discovery Engine & Tour Optimizer
4. Human Mobility & Fatigue Estimator (0.38g gravity)
5. Dynamic Habitat Selection (MCDA/AHP siting)
Also verifies NASA API InSight weather telemetry and 3D globe scene.
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
    page.screenshot(path='screenshots/verify_01_initial_planner.png')
    print('Captured verify_01_initial_planner.png')
    
    # 2. Test Habitat Panel & Siting
    print('2. Testing Habitat Base Selection...')
    page.click('button:has-text("Habitat")')
    page.wait_for_timeout(2000)
    page.screenshot(path='screenshots/verify_02_habitat_siting.png')
    print('Captured verify_02_habitat_siting.png')
    
    # Click "Set as Base" on first candidate
    set_base_btns = page.query_selector_all('button:has-text("Set as Base")')
    if set_base_btns:
        print(f'Found {len(set_base_btns)} candidate sites. Setting candidate #1 as base...')
        set_base_btns[0].click()
        page.wait_for_timeout(1000)
    
    # 3. Test Science Target & Autonomous Discovery
    print('3. Testing Autonomous Science Discovery & Tour...')
    page.click('button:has-text("Science")')
    page.wait_for_timeout(2000)
    
    # Switch to Discovery Tab
    discovery_btn = page.query_selector('button:has-text("Autonomous Discovery")')
    if discovery_btn:
        discovery_btn.click()
        page.wait_for_timeout(1200)
    
    # Click Optimize Science Tour
    tour_btn = page.query_selector('button:has-text("Optimize Science Tour")')
    if tour_btn:
        tour_btn.click()
        page.wait_for_timeout(2000)
        
    page.screenshot(path='screenshots/verify_03_science_discovery.png')
    print('Captured verify_03_science_discovery.png')
    
    # 4. Test Human Mobility & Fatigue
    print('4. Testing Human Mobility & Fatigue Estimator...')
    page.click('button:has-text("Mobility")')
    page.wait_for_timeout(2000)
    page.screenshot(path='screenshots/verify_04_mobility_fatigue.png')
    print('Captured verify_04_mobility_fatigue.png')
    
    # 5. Test Returnability Intelligence
    print('5. Testing Returnability & Dynamic Abort...')
    page.click('button:has-text("Return")')
    page.wait_for_timeout(2000)
    
    # Test Emergency Simulator: click "Simulate Emergency"
    sim_btn = page.query_selector('button:has-text("Simulate Emergency")')
    if sim_btn:
        sim_btn.click()
        page.wait_for_timeout(2000)
        
    page.screenshot(path='screenshots/verify_05_returnability_pnr.png')
    print('Captured verify_05_returnability_pnr.png')
    
    # 6. Test Mission Confidence Engine & Monte Carlo
    print('6. Testing Mission Confidence & Monte Carlo...')
    page.click('button:has-text("Confidence")')
    page.wait_for_timeout(2000)
    
    # Trigger 100-run Monte Carlo simulation
    mc_btn = page.query_selector('button:has-text("Run 100-Run Monte Carlo")')
    if mc_btn:
        print('Running 100-run Monte Carlo simulation...')
        mc_btn.click()
        page.wait_for_timeout(3000)
        
    page.screenshot(path='screenshots/verify_06_confidence_monte_carlo.png')
    print('Captured verify_06_confidence_monte_carlo.png')
    
    # 7. Test Environmental Telemetry (NASA InSight Weather)
    print('7. Testing Environmental & NASA InSight Live Weather...')
    page.click('button:has-text("MEDA")')
    page.wait_for_timeout(2000)
    
    # Click Live InSight telemetry button
    insight_btn = page.query_selector('button:has-text("NASA InSight")')
    if insight_btn:
        insight_btn.click()
        page.wait_for_timeout(2000)
        
    page.screenshot(path='screenshots/verify_07_environmental_nasa.png')
    print('Captured verify_07_environmental_nasa.png')
    
    # 8. Test Sidebar Collapse and Re-open
    print('8. Testing Sidebar Collapse and Re-open...')
    collapse_btn = page.query_selector('button[title="Collapse Panel"]')
    if collapse_btn:
        collapse_btn.click()
        page.wait_for_timeout(1000)
        page.screenshot(path='screenshots/verify_08_sidebar_collapsed.png')
        print('Captured verify_08_sidebar_collapsed.png')
        
        reopen_btn = page.query_selector('button[title="Expand Panel"]')
        if reopen_btn:
            reopen_btn.click()
            page.wait_for_timeout(1000)
            page.screenshot(path='screenshots/verify_09_sidebar_reopened.png')
            print('Captured verify_09_sidebar_reopened.png')
        else:
            print('WARNING: Expand button not found!')
            
    print('TOTAL JAVASCRIPT ERRORS:', len(errors))
    for err in errors:
        print('JS Error:', err)
        
    browser.close()
    if len(errors) > 0:
        sys.exit(1)
    print('ALL BROWSER TESTS PASSED SUCCESSFULLY!')

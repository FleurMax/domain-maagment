import csv
import requests
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

# Keywords signaling a parking page or domain-for-sale lander
PARKING_KEYWORDS = [
    "this domain is for sale",
    "domain is available",
    "parked on",
    "godaddy lander",
    "buy this domain",
    "make an offer",
    "interested in this domain",
    "is available to buy",
    "hosted by godaddy",
    "dan.com",
    "afternic.com",
    "sedo.com",
    "hugedomains.com"
]

PARKING_DOMAINS = [
    "afternic.com",
    "dan.com",
    "sedo.com",
    "godaddy.com",
    "parking.nameserver.com",
    "uniregistry.com",
    "hugedomains.com"
]

def check_domain(domain):
    """
    Checks if a domain is actively 'in use' or sitting on a lander page.
    Returns: (domain, status, detail)
    """
    try:
        url = f"http://{domain}"
        # We follow redirects and set a reasonable timeout
        response = requests.get(url, timeout=10, allow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        })
        
        final_url = response.url.lower()
        final_domain = urlparse(final_url).netloc.lower()
        content = response.text.lower()

        # 1. Check if redirected to a known parking platform
        if any(park in final_domain for park in PARKING_DOMAINS):
            return domain, "PARKED", f"Redirected to {final_domain}"

        # 2. Check for keywords in the page content
        if any(keyword in content for keyword in PARKING_KEYWORDS):
            return domain, "PARKED", "Keywords on page suggest for-sale lander"

        # 3. Basic active check (if it's not parked and gives a 200)
        if response.status_code == 200:
            return domain, "ACTIVE", "Appears in use"
        
        return domain, "UNKNOWN", f"HTTP {response.status_code}"

    except requests.exceptions.RequestException as e:
        return domain, "INACTIVE", str(e)

def run_checks(csv_path):
    print(f"[*] Reading domains from {csv_path}...")
    domains = []
    try:
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                d = row.get('Domain Name')
                if d:
                    domains.append(d)
    except Exception as e:
        print(f"[!] Error reading CSV: {e}")
        return

    print(f"[*] Starting scan for {len(domains)} domains (Using 10 threads)...")
    results = []
    
    # Using ThreadPoolExecutor for concurrent requests
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(check_domain, domains))

    # Output formatting
    print("\nCheck Results:")
    print("-" * 80)
    print(f"{'Domain':<40} | {'Status':<10} | {'Detail'}")
    print("-" * 80)
    
    active_count = 0
    parked_count = 0
    inactive_count = 0

    # Save results to a new CSV for later use
    with open('domain_usage_report.csv', mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Domain', 'Status', 'Detail'])
        
        for domain, status, detail in results:
            print(f"{domain:<40} | {status:<10} | {detail}")
            writer.writerow([domain, status, detail])
            if status == "ACTIVE": active_count += 1
            if status == "PARKED": parked_count += 1
            if status == "INACTIVE": inactive_count += 1

    print("-" * 80)
    print(f"Summary: {active_count} Active, {parked_count} Parked/Lander, {inactive_count} Offline/Error.")
    print("[*] Full report saved to 'domain_usage_report.csv'")

if __name__ == "__main__":
    target_csv = "domainexport_20260327_410pm.csv"
    run_checks(target_csv)

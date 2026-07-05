import os
import requests
import time
from typing import Optional, Dict, Any

from dotenv import load_dotenv

# --- Configuration ---

load_dotenv()  # Load environment variables from .env file

COURTLISTENER_API_TOKEN = os.environ.get("COURTLISTENER_API_TOKEN")

if not COURTLISTENER_API_TOKEN:
    raise EnvironmentError("COURTLISTENER_API_TOKEN environment variable not set.")

API_BASE_URL = "https://www.courtlistener.com/api/rest/v4"
AUTH_HEADER = {"Authorization": f"Token {COURTLISTENER_API_TOKEN}"}
DOWNLOAD_PATH = "./patent_complaints"  # Directory to save complaints

# --- Helper Functions ---

def search_patent_dockets() -> list[Dict[str, Any]]:
    """
    Searches the CourtListener dockets API for patent cases (NOS 830).
    """
    print("Searching for patent dockets (Nature of Suit 830)...")
    url = f"{API_BASE_URL}/dockets/"
    params = {
        "nature_of_suit__icontains": "830",
        "cause_icontains": "infringement",
        "order_by": "date_filed"
    }
    
    try:
        response = requests.get(url, headers=AUTH_HEADER, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"Found {data.get('count', 0)} total matching dockets.")
        return data.get("results", [])
        
    except requests.exceptions.RequestException as e:
        print(f"Error searching dockets: {e}")
        return []

def find_complaint_document(docket_id: int) -> Optional[Dict[str, Any]]:
    """
    Given a docket ID, finds the complaint document using the /search/ API.
    
    This searches for RECAP documents (type='r') associated with
    the docket_id and matching the text 'complaint'.
    """
    print(f"  Searching for complaint in docket ID: {docket_id}")
    
    # *** THIS IS THE CORRECTED URL AND METHOD ***
    search_url = f"{API_BASE_URL}/search/" 
    
    params = {
        "type": "r",  # 'r' stands for RECAP documents
        "docket": docket_id,  # Filter by the docket's ID
        "q": "complaint",  # Free-text search for 'complaint'
        "document_number": 1,  # Specific to document #1
    }
    
    try:
        response = requests.get(search_url, headers=AUTH_HEADER, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = data.get("results", [])
        if results:
            # The search endpoint returns document objects directly
            return results[0]
        else:
            print("  -> Complaint document not found via search.")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"  -> Error fetching document via search: {e}")
        return None

def download_recap_document(entry: Dict[str, Any], case_name: str):
    """
    Downloads the PDF for a given document entry from its RECAP URL.
    
    Note: The search result object has the download_url directly.
    """
    download_url = entry.get("download_url")
    if not download_url:
        print("  -> No RECAP download URL found for this entry. Skipping.")
        return

    # Sanitize the case name for use as a filename
    safe_case_name = "".join(
        c for c in case_name if c.isalnum() or c in (' ', '.', '_')
    ).rstrip()
    
    # Get the document number from the entry for the filename
    doc_num = entry.get("document_number", "N/A")
    filename = f"{safe_case_name} (Doc {doc_num}).pdf"
    filepath = os.path.join(DOWNLOAD_PATH, filename)
    
    print(f"  -> Downloading complaint to: {filepath}")

    try:
        response = requests.get(download_url, headers=AUTH_HEADER)
        response.raise_for_status()
        
        with open(filepath, "wb") as f:
            f.write(response.content)
        print("  -> Download complete.")
        
    except requests.exceptions.RequestException as e:
        print(f"  -> Error downloading document: {e}")

# --- Main Execution ---

def main():
    """
    Main function to run the complete workflow.
    """
    if not os.path.exists(DOWNLOAD_PATH):
        os.makedirs(DOWNLOAD_PATH)
        print(f"Created download directory: {DOWNLOAD_PATH}")

    dockets = search_patent_dockets()
    
    if not dockets:
        print("No dockets found. Exiting.")
        return

    for docket in dockets[:2]:  # Limit to first 10 for this example
        case_name = docket.get("case_name", "Unknown_Case")
        docket_id = docket.get("id")
        
        if not docket_id:
            continue
            
        print(f"\nProcessing case: {case_name}")
        
        # Use the new function name
        complaint_document = find_complaint_document(docket_id)
        
        if complaint_document:
            download_recap_document(complaint_document, case_name)
        
        # Be a good API citizen and rate limit your requests
        time.sleep(1) 

if __name__ == "__main__":
    main()
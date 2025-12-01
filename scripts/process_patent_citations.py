#!/usr/bin/env python3
"""
Script to process patent citations CSV and query USPTO ODP API for application numbers.

This script reads a CSV file with two fields per row and queries the USPTO ODP API
to get the application number and assignee name for each patent/publication.
It adds the application number (with "US" prefix) as a third column, and the assignee name as a fourth column.
"""

import csv
import json
import os
import sys
from typing import Any

import requests
from dotenv import load_dotenv
from tenacity import (
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

# Load environment variables from .env file
load_dotenv()

class USPTOApiError(RuntimeError):
    pass


class USPTONotFoundError(USPTOApiError):
    """Raised when the USPTO API returns a 404 Not Found error."""
    pass

def _safe_str(value: Any) -> str:
    if isinstance(value, str):
        value = value.replace('"', '')
        return value.strip()
    return ""

def _find_first_string(node: Any, key: str) -> str | None:
    if isinstance(node, dict):
        if key in node and isinstance(node[key], str):
            candidate = node[key].strip()
            if candidate:
                return _safe_str(candidate)
        for value in node.values():
            result = _find_first_string(value, key)
            if result:
                return _safe_str(result)
    elif isinstance(node, list):
        for item in node:
            result = _find_first_string(item, key)
            if result:
                return _safe_str(result)
    return None

def get_api_key() -> str:
    """Get USPTO ODP API key from environment variable."""
    api_key = os.getenv('USPTO_ODP_API_KEY')
    if not api_key:
        raise ValueError("USPTO_ODP_API_KEY environment variable is required")
    return api_key


def create_request_body(patent_value: str) -> dict[str, Any]:
    """
    Create the request body for USPTO ODP API based on the patent value format.
    
    Args:
        patent_value: The patent/publication number from the third column
        
    Returns:
        Dictionary representing the request body for the API call
    """
    if patent_value.startswith("US"):
        # For publication numbers starting with "US"
        return {
            "q": None,
            "filters": [
                {
                    "name": "applicationMetaData.earliestPublicationNumber",
                    "value": [patent_value]
                },
                {
                    "name": "applicationMetaData.publicationCategoryBag",
                    "value": ["Pre-Grant Publications - PGPub"]
                }
            ]
        }
    else:
        # For patent numbers starting with digits
        return {
            "q": None,
            "filters": [
                {
                    "name": "applicationMetaData.patentNumber",
                    "value": [patent_value]
                },
                {
                    "name": "applicationMetaData.publicationCategoryBag",
                    "value": ["Granted/Issued"]
                }
            ]
        }

@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_not_exception_type(USPTONotFoundError),
)
def query_uspto_api(patent_value: str, api_key: str) -> tuple[str, str] | None:
    """
    Query the USPTO ODP API for the given patent value.
    
    Args:
        patent_value: The patent/publication number to query
        api_key: USPTO ODP API key
        
    Returns:
        Application number with "US" prefix, or None if not found or error occurred
    """
    url = "https://api.uspto.gov/api/v1/patent/applications/search"
    headers = {
        "Content-Type": "application/json",
        "X-API-KEY": api_key
    }
    
    request_body = create_request_body(patent_value)
    
    try:
        response = requests.post(url, headers=headers, json=request_body, timeout=30)
        response.raise_for_status()
        
        response_data = response.json()

        first_patent_data = None
        app_number_plus_assignee_name = []
        
        # Extract applicationNumberText from the response based on the actual USPTO API schema
        # The structure is: response -> patentFileWrapperDataBag -> [0] -> applicationNumberText
        if 'patentFileWrapperDataBag' in response_data and response_data['patentFileWrapperDataBag']:
            first_patent_data = response_data['patentFileWrapperDataBag'][0]
            if 'applicationNumberText' in first_patent_data:
                app_number = first_patent_data['applicationNumberText']
                app_number_plus_assignee_name.append(f"US{app_number}")
        
        assignment_bag = first_patent_data.get("assignmentBag") if first_patent_data else None
        if isinstance(assignment_bag, list):
            for assignment in assignment_bag:
                assignee_bag = assignment.get("assigneeBag")
                if isinstance(assignee_bag, list):
                    for assignee in assignee_bag:
                        name = _safe_str(assignee.get("assigneeNameText"))
                        if name:
                            app_number_plus_assignee_name.append(name)
        elif isinstance(assignment_bag, dict):
            name = _safe_str(assignment_bag.get("assigneeNameText"))
            if name:
                app_number_plus_assignee_name.append(name)
        else:
            app_number_plus_assignee_name.append(_find_first_string(response_data, "assigneeNameText") or "")
        
        if len(app_number_plus_assignee_name) != 2:
            return None
        
        return app_number_plus_assignee_name[0], app_number_plus_assignee_name[1]
        
    except requests.exceptions.RequestException as e:
        print(f"Error querying API for {patent_value}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response for {patent_value}: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error for {patent_value}: {e}")
        return None


def process_csv_file(input_file: str, output_file: str) -> None:
    """
    Process the CSV file and add application numbers as fourth column.
    
    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
    """
    api_key = get_api_key()
    
    with open(input_file, newline='', encoding='utf-8') as infile, \
         open(output_file, 'w', newline='', encoding='utf-8') as outfile:
        
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        processed_count = 0
        success_count = 0
        
        for row_num, row in enumerate(reader, 1):
            if len(row) < 3:
                print(f"Warning: Row {row_num} has less than 3 columns, skipping")
                continue
            
            # Get the third column value (index 2)
            patent_value = row[2].strip()
            
            
            
            # Query the API
            application_number, assignee_name = query_uspto_api(patent_value, api_key) or (None, None)


            if application_number and assignee_name:
                print(f"+ WRITING ROW {row_num} || Citing: {row[0]}; Cited: {patent_value}, Cited Appn #: {application_number}, Cited Assignee: {assignee_name}.")
                
                # Create new row with the application number as fourth column
                new_row = [row[0]] +[row[1]] + [application_number or ""] + [assignee_name or ""]
                
                writer.writerow(new_row)
                
                processed_count += 1
                success_count += 1
            else:
                print(f"- SKIPPING ROW {row_num} || Citing: {row[0]}; Cited: {patent_value}.")
                processed_count += 1
                
            # Add a small delay to be respectful to the API
            if processed_count % 100 == 0:
                print(f"Processed {processed_count} rows, {success_count} successful API calls")
    
    print(f"Processing complete. Total rows: {processed_count}, Successful API calls: {success_count}")


def main():
    """Main function to handle command line arguments and execute processing."""
    if len(sys.argv) != 3:
        print("Usage: python process_patent_citations.py <input_csv> <output_csv>")
        print("Example: python process_patent_citations.py us_patent_citations.csv output_with_app_numbers.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' does not exist")
        sys.exit(1)
    
    try:
        process_csv_file(input_file, output_file)
        print(f"Results written to {output_file}")
    except Exception as e:
        print(f"Error processing file: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()